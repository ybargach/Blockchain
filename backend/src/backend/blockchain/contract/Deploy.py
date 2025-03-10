import os
from dotenv import load_dotenv 
from web3 import Web3
from web3.exceptions import TimeExhausted
import marshal
import time

load_dotenv()

with open("/backend/blockchain/contract/Compile_file", "rb") as f:
    variables = marshal.load(f)

abi = variables["abi"]
bytecode = variables["bytecode"]
print("Loaded ABI and Bytecode")

infura_url = os.getenv("infura_url")
web3 = Web3(Web3.HTTPProvider(infura_url))

if not web3.is_connected():
    raise ConnectionError("Failed to connect to Ethereum network")

private_key = os.getenv("private_key")
sender_address = os.getenv("sender_address")

gas = 3000000
max_retries = 3
retry_count = 0
success_transaction = False
tx_receipt = None
faster_gas_price = int(web3.eth.gas_price * 1.1)

while retry_count < max_retries:
    try:
        For_Deploy = web3.eth.contract(abi=abi, bytecode=bytecode)
        transaction = For_Deploy.constructor().build_transaction({
            'from': sender_address,
            'nonce': web3.eth.get_transaction_count(sender_address, "pending"),
            'gas': gas,
            'gasPrice': faster_gas_price,
        })
        signed_txn = web3.eth.account.sign_transaction(transaction, private_key)
        tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
        try:
            tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            if tx_receipt["status"] != 1:
                print("Transaction failed. Retrying...")
                success_transaction = False
                break
            print("Transaction confirmed!")
            success_transaction = True
            break
        except TimeExhausted:
            print("Transaction timed out. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            print(f"Unexpected error while waiting: {e}")
            break
        if success_transaction:
            break
    except Exception as e:
        if "insufficient funds" in str(e).lower():
            print("Error: Insufficient funds in your wallet to deploy the contract.")
            exit(1)
        else:
            print(f" An unexpected error occurred: {e}")
    gas = int(gas * 1.2)
    retry_count += 1
    print(f"Retrying with increased gas: {gas}")

if not success_transaction or tx_receipt is None:
    print("Failed to deploy contract after multiple attempts.")
    exit(1)

contract_address = tx_receipt.contractAddress
print(f"Contract deployed at: {contract_address}")

Save_Data = {
    "contract_address": contract_address,
    "abi": abi,
}

with open("/backend/blockchain/contract/Deploy_file", "wb") as file:
    marshal.dump(Save_Data, file)

print("Deployment Data Saved. Done!")