import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from reporting import ReportGenerator
from run_evaluation import build_prompt, extract_scores, verdict_for


def is_valid_report(report):
    return "# QVPro Master Analysis" in report and (
        "N/A" in report or "Score:" in report
    )

def test_engine():
    print("--- STARTING QVPRO ENGINE VERIFICATION ---")
    print("\n[Step 1] Checking live evaluation helpers...")
    prompt = build_prompt({"target_name": "Test Venture"})
    assert "Test Venture" in prompt
    scores = extract_scores(
        "Overall score: 80\nOpportunity score: 75\n"
        "Commercial score: 70\nRisk score: 20"
    )
    assert scores == {
        "Overall": 80,
        "Opportunity": 75,
        "Commercial": 70,
        "Risk": 20,
    }
    assert verdict_for(scores) == "Moderate Build / Proceed with Caution"
    print("Evaluation helpers: Validated")

    print("\n[Step 2] Generating a sample report...")
    section_names = ("market", "product", "competitor", "financial",
                     "commercial", "monetization", "growth", "risks")
    report_data = {
        "target_name": "Test Venture",
        "analysis": {name: f"{name} analysis" for name in section_names},
        "scores": {name: None for name in section_names + ("overall",)},
        "verdict": "Insufficient Evidence for Verdict",
        "timestamp": "2026-01-01",
    }
    report = ReportGenerator().generate(report_data)
    assert is_valid_report(report)
    assert "Monetization Strategy (Score: N/A)" in report
    assert not is_valid_report("Score: 90 without the required heading")
    assert not is_valid_report("# QVPro Master Analysis without a score")
    print("Report content: Validated")

    print("\n--- VERIFICATION COMPLETE: ALL SYSTEMS FUNCTIONAL ---")

if __name__ == "__main__":
    test_engine()