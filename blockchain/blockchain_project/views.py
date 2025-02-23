from django.shortcuts import render
from web3 import Web3
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
import os
from dotenv import load_dotenv
import marshal

load_dotenv()

Deploy_file = "/home/lastjoker/Desktop/return/blockchain/Deploy_file"

if not os.path.exists(Deploy_file):
    raise FileNotFoundError(f"The required file '{Deploy_file}' does not exist. Please ensure it is created.")

with open(Deploy_file, "rb") as f:
    Save_Data = marshal.load(f)

abi = Save_Data["abi"]
contract_address = Save_Data["contract_address"]

infura_url = os.getenv("infura_url")
private_key = os.getenv("private_key")
sender_address = os.getenv("sender_address")

web3 = Web3(Web3.HTTPProvider(infura_url))
address = web3.to_checksum_address(contract_address)
contract = web3.eth.contract(address=address, abi=abi)

class GetBalance(APIView):
    def post(self, request):
        try:
            Balance = contract.functions.Get_balance().call()
            Balance = web3.from_wei(Balance, 'ether')
            if Balance < 0.3:
                return Response(
                    {"error": "You can't start the tournament because you don't have enough balance", "balance": Balance}, 
                    status=403)
            return Response({"ETH Balance": Balance}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)  # Keep 500 for actual errors


class GetAllScoresAPIView(APIView):
    def post(self, request):
        print("here 2")
        try:
            all_scores = contract.functions.Get_AllScore().call()
        except Exception as e:
            return Response({"error": f"Error retrieving data from contract: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        grouped_scores = {}
        for player in all_scores:
            tournament_id = player[0]
            match_data = {
                "Id_Tournament": tournament_id,
                "Round": player[1],
                "Name_Winner": player[2],
                "Score_Winner": player[3],
                "Name_Losser": player[4],
                "Score_Losser": player[5]
            }

            if tournament_id not in grouped_scores:
                grouped_scores[tournament_id] = []
            
            grouped_scores[tournament_id].append(match_data)

        formatted_response = {"all_scores": list(grouped_scores.values())}

        return Response(formatted_response, status=status.HTTP_200_OK)


class SaveDataToBlockchainAPIView(APIView):
    def post(self, request):
        print("here 1")
        try:
            round = request.data.get("round")
            Winner1 = request.data.get("Winner1")
            Score_winner1 = int(request.data.get("Score_winner1"))
            Losser1 = request.data.get("Losser1")
            Score_losser1 = int(request.data.get("Score_losser1"))

            if not round or not Winner1 or not Losser1 or not Score_winner1 or not Score_losser1:
                return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)
            print("here 2")
            transaction = contract.functions.Set_Score(
                round, Winner1, Score_winner1, Losser1, Score_losser1
            ).build_transaction({
                'from': sender_address,
                'nonce': web3.eth.get_transaction_count(sender_address),
                'gas': 3000000,
                'gasPrice': web3.eth.gas_price,
            })
            try:
                print("here 3")
                signed_txn = web3.eth.account.sign_transaction(transaction, private_key)
                print("here 4")
                
                # Print the signed transaction object to see its structure
                print(f"Signed transaction object: {signed_txn}")
                
                # Access the 'rawTransaction' attribute directly
                tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
                
                print("here 5")
                web3.eth.wait_for_transaction_receipt(tx_hash)
                print("here 6")

            except Exception as e:
                print(f"An error occurred: {e}")

            return Response({
                "message": "Data saved successfully",
                "transaction_hash": tx_hash.hex()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        
    
