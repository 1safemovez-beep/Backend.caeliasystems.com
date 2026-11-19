import os
from cryptography.fernet import Fernet

class SecureVault:
    def __init__(self):
        self.key = os.getenv("QV_DATA_ENCRYPTION_KEY")
            
        self.fernet = None
        
        if self.key:
            try:
                self.fernet = Fernet(self.key.encode() if isinstance(self.key, str) else self.key)
            except Exception as e:
                print(f"[SecureVault] Error initializing Fernet: {str(e)}")
                self.fernet = None

    def encrypt(self, data):
        """Encrypt data, refusing to proceed without a valid key."""
        if not self.fernet:
            raise Exception("VAULT_LOCKED: no key, refusing plaintext")
        if not data:
            return data
        
        try:
            if isinstance(data, str):
                data = data.encode()
            return self.fernet.encrypt(data).decode()
        except Exception as e:
            print(f"[SecureVault] Encryption error: {str(e)}")
            raise Exception("VAULT_LOCKED: encryption failed, refusing plaintext")

    def decrypt(self, encrypted_data):
        """Decrypt data, refusing to proceed without a valid key."""
        if not self.fernet:
            raise Exception("VAULT_LOCKED: no key, refusing plaintext")
        if not encrypted_data:
            return encrypted_data
            
        try:
            return self.fernet.decrypt(encrypted_data.encode()).decode()
        except Exception as e:
            print(f"[SecureVault] Decryption error: {str(e)}")
            raise Exception("VAULT_LOCKED: decryption failed, refusing plaintext")

    @staticmethod
    def generate_key():
        """Helper to generate a new key to set in secrets."""
        return Fernet.generate_key().decode()
