import os
import tempfile

from evaluator_engine import QuantVantageAI
from security import SecureVault


def test_engine():
    with tempfile.TemporaryDirectory() as temp_dir:
        report_path = os.path.join(temp_dir, "report.md")
        report_path = QuantVantageAI("Test Venture").generate_report(output_path=report_path)
        with open(report_path, encoding="utf-8") as report_file:
            report = report_file.read()
        assert "# QVPro Master Analysis" in report
        assert "Overall Score:" in report

    original_key = os.environ.pop("QV_DATA_ENCRYPTION_KEY", None)
    try:
        try:
            SecureVault().encrypt("sensitive data")
        except Exception as error:
            assert "VAULT_LOCKED" in str(error)
        else:
            raise AssertionError("Encryption must fail without a key")

        os.environ["QV_DATA_ENCRYPTION_KEY"] = "invalid"
        try:
            SecureVault().encrypt("sensitive data")
        except Exception as error:
            assert "VAULT_LOCKED" in str(error)
        else:
            raise AssertionError("Encryption must fail with an invalid key")

        os.environ["QV_DATA_ENCRYPTION_KEY"] = SecureVault.generate_key()
        vault = SecureVault()
        encrypted = vault.encrypt("sensitive data")
        assert encrypted != "sensitive data"
        assert vault.decrypt(encrypted) == "sensitive data"
    finally:
        os.environ.pop("QV_DATA_ENCRYPTION_KEY", None)
        if original_key is not None:
            os.environ["QV_DATA_ENCRYPTION_KEY"] = original_key

    print("QVPro report and fail-closed vault verification passed.")

if __name__ == "__main__":
    test_engine()
