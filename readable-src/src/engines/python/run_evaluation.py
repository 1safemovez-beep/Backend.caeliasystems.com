#!/usr/bin/env python3
"""
QuantVantage headless evaluation runner — invoked by the Node backend via
child_process with JSON on stdin, JSON on stdout.

Input (stdin JSON):
  { "target_name": str, "context_notes": str, "ad_price_note": str,
    "commercial_price_note": str, "mode": "commercial" | "personal" }

Output (stdout JSON):
  Success: { "ok": true, "mode": ..., "scores": {Overall, Opportunity,
             Commercial, Risk}, "verdict": str, "report_markdown": str,
             "generated_at": iso }
  Not ready: { "ok": false, "error": "ENGINE_NEEDS_KEY",
               "needs": [ {name, present, how} ... ] }

HONESTY RULE: without ANTHROPIC_API_KEY there is no real evaluation — the
runner reports ENGINE_NEEDS_KEY instead of faking scores. The old
evaluator_engine.py hardcoded 78/81/76/58 for every input; it is NOT used
as an evaluation source here (kept out of the pipeline deliberately).
"""
import json
import os
import re
import sys
from datetime import datetime, timezone


def needs_checklist():
    def present(name):
        v = os.environ.get(name, "")
        return bool(v and not v.startswith("PASTE_"))

    items = [
        {"name": "ANTHROPIC_API_KEY",
         "present": present("ANTHROPIC_API_KEY"),
         "how": "Alicia's key — she enters it herself at deploy (never in chat/code). Enables live AI evaluations."},
        {"name": "anthropic python package",
         "present": _has_anthropic(),
         "how": "pip install -r src/engines/python/requirements.txt on the host."},
        {"name": "python3",
         "present": True,
         "how": "Interpreter running this script."},
        {"name": "STRIPE_SECRETS_KEY (optional)",
         "present": present("STRIPE_SECRETS_KEY"),
         "how": "Only needed for paid report-unlock verification. Evaluations run without it."},
    ]
    return items


def _has_anthropic():
    try:
        import anthropic  # noqa: F401
        return True
    except Exception:
        return False


def extract_scores(report_text):
    scores = {}
    patterns = {
        "Overall": r"Overall score:\*?\*?\s*(\d+)",
        "Opportunity": r"Opportunity score:\*?\*?\s*(\d+)",
        "Commercial": r"Commercial score:\*?\*?\s*(\d+)",
        "Risk": r"Risk score:\*?\*?\s*(\d+)",
    }
    for label, pat in patterns.items():
        m = re.search(pat, report_text or "")
        if m:
            try:
                scores[label] = int(m.group(1))
            except ValueError:
                pass
    return scores if len(scores) == 4 else {}


def verdict_for(scores):
    overall = scores.get("Overall")
    if overall is None:
        return "Insufficient Evidence for Verdict"
    if overall >= 85:
        return "Strong Buy / High Priority Build"
    if overall >= 70:
        return "Moderate Build / Proceed with Caution"
    if overall >= 50:
        return "Pivotal Strategy Required"
    return "High Risk / Avoid or Major Re-engineering Needed"


def build_prompt(p):
    name = p.get("target_name", "").strip()
    context_notes = p.get("context_notes", "") or "None"
    ad_note = p.get("ad_price_note", "") or "None"
    price_note = p.get("commercial_price_note", "") or "None"
    mode = p.get("mode", "commercial")
    lens = ("commercial buyer" if mode == "commercial"
            else "personal creator deciding whether to build")
    return (
        "Generate a concise 6-8 page markdown creation evaluation for idea: "
        f"'{name}', judged through a {lens} lens. Use exactly this structure and headings:\n"
        "PAGE 1: Executive Summary\n"
        "- Overall score\n- Opportunity score\n- Commercial score\n- Risk score\n"
        "- Recommended next step\n"
        "- WHAT YOU'LL GET section including: Market opportunity analysis, Competitor analysis, "
        "Customer/target-market analysis, Commercial viability, Revenue-model analysis, Risk analysis, "
        "Strategic recommendations, Action plan, Financial scenario analysis, Possible value estimate "
        "(rough planning estimate, not a valuation).\n"
        "PAGE 2: Market & Opportunity\n"
        "PAGE 3: Commercial Analysis\n"
        "Include a Competitive comparison subsection with four parts: (1) what already exists — name the "
        "real competitors or alternatives; (2) where this idea improves on them — what it does better; "
        "(3) gaps the competitors leave — what they lack; (4) what the creator could do to pull ahead — "
        "concrete improvements. Be specific and honest; if the idea has no real edge over what exists, "
        "say so plainly.\n"
        "Include a Financial picture subsection: estimated startup cost range; three revenue scenarios "
        "(conservative/base/optimistic) showing the math as audience x conversion x price; a break-even "
        "sketch; and 2 possible levers (e.g. if acquisition cost fell 20%, show how margin moves) framed "
        "as possibilities, never guarantees.\n"
        "PAGE 4: Top Risks (3-5 only, ranked with Critical / Moderate indicators, each with Risk / Why it "
        "matters / How to reduce it)\n"
        "PAGE 5: Strategic Recommendations (Immediate actions, 30-day, 60-day, 90-day priorities)\n"
        "PAGE 6: Optional Deep-Dive Material (optional section, concise).\n"
        "PAGE 7: Possible Value Estimate\n"
        "- Give one estimated dollar range for what this creation could be worth at a small-scale launch "
        "(for example \"$X - $Y\"), then 2-3 sentences beginning with \"because\" that spell out the "
        "assumptions behind it (audience size, price point, conversion rate). Tie the range to the scores "
        "above. Label it plainly as a rough planning estimate — never a professional valuation, never a "
        "guarantee, never investment advice.\n"
        "Use language for market analysis, creation analysis, commercial evaluation, financial scenario "
        "analysis, creation assumptions, and commercial recommendations. Do not provide personalized "
        "investment advice. Do not include buy/sell signals, brokerage guidance, or guaranteed predictions. "
        "Remove repetitive filler.\n"
        "SCORING RUBRIC — use the full 0-100 range and make scores discriminate between strong and weak "
        "inputs. 90-100: exceptional, clear demand, strong defensibility. 70-89: solid concept with real "
        "opportunity and manageable risks. 40-69: plausible but unproven, major assumptions untested. "
        "10-39: weak, vague, or fundamentally flawed concept. 0-9: no evaluable content. Judge the idea AS "
        "DESCRIBED, not its best possible version. If the input is only a URL, a company name, or a few "
        "words with no description of what the creation does, who it serves, or how it earns money, scores "
        "must reflect that: overall score below 30, and state plainly what information is missing. Never "
        "default to the middle. Two different ideas must get meaningfully different scores. If every idea "
        "scores the same, the scoring has failed.\n"
        f"User context notes: {context_notes}\n"
        f"Advertising price note: {ad_note}\n"
        f"Commercial price note: {price_note}"
    )


def run_live(p):
    import anthropic
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2400,
        messages=[{"role": "user", "content": build_prompt(p)}],
    )
    report = response.content[0].text
    scores = extract_scores(report)
    return {
        "ok": True,
        "mode": p.get("mode", "commercial"),
        "target_name": p.get("target_name", ""),
        "scores": scores,
        "verdict": verdict_for(scores),
        "report_markdown": report,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "engine": "quantvantage-live",
    }


def main():
    try:
        raw = sys.stdin.read()
        params = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(json.dumps({"ok": False, "error": "BAD_INPUT",
                          "detail": f"stdin was not valid JSON: {e}"}))
        return 2

    if not (params.get("target_name") or "").strip():
        print(json.dumps({"ok": False, "error": "BAD_INPUT",
                          "detail": "target_name is required"}))
        return 2

    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key or key.startswith("PASTE_") or not _has_anthropic():
        print(json.dumps({"ok": False, "error": "ENGINE_NEEDS_KEY",
                          "detail": "No live evaluation possible without ANTHROPIC_API_KEY "
                                    "+ the anthropic package. Nothing was faked.",
                          "needs": needs_checklist()}))
        return 3

    try:
        print(json.dumps(run_live(params)))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "error": "ENGINE_FAILED",
                          "detail": str(e)[:500]}), file=sys.stderr)
        print(json.dumps({"ok": False, "error": "ENGINE_FAILED",
                          "detail": "The AI service call failed. No report generated."}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
