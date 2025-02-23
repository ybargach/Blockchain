import os
from dotenv import load_dotenv 
from web3 import Web3
from web3.exceptions import TimeExhausted
import marshal
import time

load_dotenv()

with open("Compile_file", "rb") as f:
    variables = marshal.load(f)
    f.close()
    os.remove("Compile_file")

abi = variables["abi"]
bytecode = variables["bytecode"]
success = False

print("Done import variables")

infura_url = os.getenv("infura_url")
web3 = Web3(Web3.HTTPProvider(infura_url))

if not web3.is_connected():
    raise ConnectionError("Failed to connect to Ethereum network")

private_key = os.getenv("private_key")
sender_address = os.getenv("sender_address")

# Deploy the contract
while True:
    try:
        For_Deploy = web3.eth.contract(abi=abi, bytecode=bytecode)
        # Build transaction
        transaction = For_Deploy.constructor().build_transaction({
            'from': sender_address,
            'nonce': web3.eth.get_transaction_count(sender_address, "pending"),
            'gas': 3000000,
            'gasPrice': web3.eth.gas_price,
        })
        signed_txn = web3.eth.account.sign_transaction(transaction, private_key)
        tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
        
        while True:
            success_transaction = True
            try:
                if not tx_hash:
                    tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
                    print(f"Transaction sent. Hash: {tx_hash.hex()}")
                
                tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                if tx_receipt['status'] != 1:
                    success_transaction = False
                    print()
                print("Transaction confirmed!")
                success = True
                break
            except TimeExhausted:
                print("Transaction timed out. Retrying...")
                time.sleep(5)
            except Exception as e:
                print(f"An error occurred: {e}")
                break
        if success_transaction == False:
            continue
        break
    except Exception as e:
        if "insufficient funds" in str(e):
            print("Error: Insufficient funds in your wallet to deploy the contract.")
        else:
            print(f"An unexpected error occurred: {e}")

contract_address = tx_receipt.contractAddress
print("Contract deployed at address:", contract_address)

Save_Data = {
                "contract_address": contract_address,
                "abi": abi,
            }

with open("Deploy_file", "wb") as file:
    marshal.dump(Save_Data, file)
    f.close()

print("Deploy is Done")
