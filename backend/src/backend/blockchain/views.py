from django.shortcuts import render
from web3 import Web3
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework import status
import os
import time
from dotenv import load_dotenv
import marshal

load_dotenv()

Deploy_file = "/backend/blockchain/contract/Deploy_file"

if not os.path.exists(Deploy_file):
    raise FileNotFoundError(f"The required file '{Deploy_file}' does not exist. Please ensure it is created.")

with open(Deploy_file, "rb") as f:
    Save_Data = marshal.load(f)

abi = Save_Data["abi"]
contract_address = Save_Data["contract_address"]

class GetBalance(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            infura_url = os.getenv("infura_url")
            private_key = os.getenv("private_key")
            sender_address = os.getenv("sender_address")
            if not infura_url or not private_key or not sender_address:
                return Response({"error": "Missing environment variables"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            web3 = Web3(Web3.HTTPProvider(infura_url))
            address = web3.to_checksum_address(contract_address)
            contract = web3.eth.contract(address=address, abi=abi)
            try:
                Balance = contract.functions.Get_balance().call()
                Balance = web3.from_wei(Balance, 'ether')
                if Balance < 0.5:
                    return Response(
                        {"error": "You can't start the tournament because you don't have enough balance", "balance": Balance}, 
                        status=403)
                Id_User = int(request.user.id)
                is_active = contract.functions.Is_Tournament_Active().call()
                if is_active:
                    active_user = contract.functions.Get_Active_User().call()
                    if active_user == Id_User:
                        return Response({"message": "You already have an active tournament"}, status=200)
                    else:
                        return Response({"error": "Another player has an active tournament"}, status=403)
                faster_gas_price = int(web3.eth.gas_price * 1.3)
                nonce = web3.eth.get_transaction_count(sender_address, 'latest')
                try:
                    transaction = contract.functions.Start_Tournament(Id_User).build_transaction({
                        'from': sender_address,
                        'nonce': nonce,
                        'gas': 3000000,
                        'gasPrice': faster_gas_price,
                    })
                    signed_txn = web3.eth.account.sign_transaction(transaction, private_key)
                    tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
                    try:
                        tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                        if tx_receipt["status"] != 1:
                            print("Transaction failed, attempting rollback...")
                            return Response({"error": "Transaction failed"}, status=500)
                    except Exception as e:
                        print(f"Transaction timeout/error: {e}")
                        return Response({"error": str(e)}, status=500)
                    is_active_after = contract.functions.Is_Tournament_Active().call()
                    if not is_active_after:
                        return Response({"error": "Failed to start tournament"}, status=500)
                    time_left = contract.functions.Get_Tournament_Time_Left().call()
                    return Response({
                        "message": "Tournament started successfully", 
                        "ETH Balance": Balance,
                        "time_left": time_left
                    }, status=200)
                except Exception as e:   
                    print(f"Transaction error details: {str(e)}")    
                    return Response({"error": str(e)}, status=500)
            except Exception as e:
                return Response({"error": str(e)}, status=500)
        except Exception as e:
            return Response({"error": f"Error retrieving data from contract: {e}"}, status=500)

class GetCancel(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            infura_url = os.getenv("infura_url")
            private_key = os.getenv("private_key")
            sender_address = os.getenv("sender_address")
            if not infura_url or not private_key or not sender_address:
                return Response({"error": "Missing environment variables"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            web3 = Web3(Web3.HTTPProvider(infura_url))
            address = web3.to_checksum_address(contract_address)
            contract = web3.eth.contract(address=address, abi=abi)
            is_active = contract.functions.Is_Tournament_Active().call()
            if not is_active:
                return Response({"message": "No active tournament to cancel"}, status=status.HTTP_200_OK)
            active_user = contract.functions.Get_Active_User().call()
            if active_user != request.user.id:
                return Response({"error": "You are not authorized to cancel this tournament"}, status=403)
            faster_gas_price = int(web3.eth.gas_price * 1.3)
            nonce = web3.eth.get_transaction_count(sender_address, 'latest')        
            try:
                transaction = contract.functions.Cancel_Tournament().build_transaction({
                    'from': sender_address,
                    'nonce': nonce,
                    'gas': 3000000,
                    'gasPrice': faster_gas_price,
                })
                signed_txn = web3.eth.account.sign_transaction(transaction, private_key)
                tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
                tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                if tx_receipt["status"] != 1:
                    return Response({"error": "Failed to cancel tournament"}, status=500)
                return Response({"success": "Tournament cancelled successfully"}, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({"error": f"Error retrieving data from contract: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GetAllScoresAPIView(APIView):
    def get(self, request):
        try:
            infura_url = os.getenv("infura_url")
            private_key = os.getenv("private_key")
            sender_address = os.getenv("sender_address")
            if not infura_url or not private_key or not sender_address:
                return Response({"error": "Missing environment variables"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            web3 = Web3(Web3.HTTPProvider(infura_url))
            address = web3.to_checksum_address(contract_address)
            contract = web3.eth.contract(address=address, abi=abi)
            try:
                all_scores = contract.functions.Get_AllScore().call()
            except Exception as e:
                return Response({"error": f"Error retrieving data from contract: {e}"}, status=500)
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
            return Response(formatted_response, status=200)
        except Exception as e:
                return Response({"error": f"Error retrieving data from contract: {e}"}, status=500)


class SaveDataToBlockchainAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            infura_url = os.getenv("infura_url")
            private_key = os.getenv("private_key")
            sender_address = os.getenv("sender_address")
            if not infura_url or not private_key or not sender_address:
                return Response({"error": "Missing environment variables"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            web3 = Web3(Web3.HTTPProvider(infura_url))
            address = web3.to_checksum_address(contract_address)
            contract = web3.eth.contract(address=address, abi=abi)
            response_data = {
                "success": True,
                "message": "Score submitted successfully"
            }
            Round = request.data.get("tournament_stage")
            player1 = request.data.get("player1")
            player2 = request.data.get("player2")
            player1_score = request.data.get("player1_score")
            player2_score = request.data.get("player2_score")
            Id_User = int(request.user.id)
            if player1 is None or player2 is None or player1_score is None or player2_score is None or Round is None:
                return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)
            player1_score, player2_score = int(player1_score), int(player2_score)
            if player1_score > player2_score:
                Winner, Score_winner, Losser, Score_losser = player1, player1_score, player2, player2_score
            else:
                Winner, Score_winner, Losser, Score_losser = player2, player2_score, player1, player1_score
            Id_Tournament = contract.functions.Get_Current_Id_Tournament().call()
            faster_gas_price = int(web3.eth.gas_price * 1.3)
            nonce = web3.eth.get_transaction_count(sender_address, 'latest')
            try:
                transaction = contract.functions.Set_Score(
                    Id_User, Round, Winner, Score_winner, Losser, Score_losser
                ).build_transaction({
                    'from': sender_address,
                    'nonce': nonce,
                    'gas': 3000000,
                    'gasPrice': faster_gas_price,
                })
                signed_txn = web3.eth.account.sign_transaction(transaction, private_key)
                tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
                tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                if tx_receipt["status"] != 1:
                    print("Transaction failed, attempting rollback...")
                    time.sleep(10)
                    self.cancel_tournament(request)
                    self.delete_score(contract, web3, sender_address, private_key, Id_Tournament)
                is_still_active = contract.functions.Is_Tournament_Active().call()
                if not is_still_active:
                    response_data["message"] = "Tournament completed successfully"
                else:
                    time_left = contract.functions.Get_Tournament_Time_Left().call()
                    response_data["time_left"] = time_left
                return Response(response_data, status=200)
            except Exception as e:
                print(f"Unexpected error: {e}")
                self.cancel_tournament(request)
                self.delete_score(contract, web3, sender_address, private_key, Id_Tournament)
                return Response({"error": f"Error retrieving data from contract: {e}"}, status=502)
        except Exception as e:
            print(f"Unexpected error: {e}")
            self.cancel_tournament(request)
            self.delete_score(contract, web3, sender_address, private_key, Id_Tournament)
            return Response({"error": f"Error retrieving data from contract: {e}"}, status=401)

    def delete_score(self, contract, web3, sender_address, private_key, tournament_id):
        try:
            faster_gas_price = int(web3.eth.gas_price * 1.3)
            nonce = web3.eth.get_transaction_count(sender_address, 'latest')
            delete_transaction = contract.functions.Delete_Score(tournament_id).build_transaction({
                'from': sender_address,
                'nonce': nonce,
                'gas': 3000000,
                'gasPrice': faster_gas_price,
            })
            signed_delete_txn = web3.eth.account.sign_transaction(delete_transaction, private_key)
            delete_tx_hash = web3.eth.send_raw_transaction(signed_delete_txn.raw_transaction)
            tx_receipt = web3.eth.wait_for_transaction_receipt(delete_tx_hash, timeout=120)
            if tx_receipt["status"] != 1:
                return Response({"error": "Failed to delete tournament scores"}, status=500)
            return Response({"success": "Tournament scores deleted successfully"}, status=200)
        except Exception as e:
            return Response({"error": f"Error deleting tournament scores: {e}"}, status=500)

    def cancel_tournament(self, request):
        try:
            infura_url = os.getenv("infura_url")
            private_key = os.getenv("private_key")
            sender_address = os.getenv("sender_address")
            if not infura_url or not private_key or not sender_address:
                return Response({"error": "Missing environment variables"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            web3 = Web3(Web3.HTTPProvider(infura_url))
            address = web3.to_checksum_address(contract_address)
            contract = web3.eth.contract(address=address, abi=abi)
            tournament_id = request.data.get('tournament_id')
            if tournament_id is None:
                return Response({"error": "Missing tournament_id parameter"}, status=400)
            is_active = contract.functions.Is_Tournament_Active().call()
            if not is_active:
                return Response({"message": "No active tournament to cancel"}, status=status.HTTP_200_OK)
            faster_gas_price = int(web3.eth.gas_price * 1.3)
            nonce = web3.eth.get_transaction_count(sender_address, 'latest')
            cancel_transaction = contract.functions.Cancel_Tournament().build_transaction({
                'from': sender_address,
                'nonce': nonce,
                'gas': 3000000,
                'gasPrice': faster_gas_price,
            })
            signed_delete_txn = web3.eth.account.sign_transaction(cancel_transaction, private_key)
            delete_tx_hash = web3.eth.send_raw_transaction(signed_delete_txn.raw_transaction)
            tx_receipt = web3.eth.wait_for_transaction_receipt(delete_tx_hash, timeout=120)
            if tx_receipt["status"] != 1:
                return Response({"error": "Failed to cancel tournament"}, status=500)
            return Response({"success": "Tournament cancelled successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Error cancelling tournament: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def check_tournament_status(self, request):
        try:
            infura_url = os.getenv("infura_url")
            private_key = os.getenv("private_key")
            sender_address = os.getenv("sender_address")
            if not infura_url or not private_key or not sender_address:
                return Response({"error": "Missing environment variables"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            web3 = Web3(Web3.HTTPProvider(infura_url))
            address = web3.to_checksum_address(contract_address)
            contract = web3.eth.contract(address=address, abi=abi)
            is_active = contract.functions.Is_Tournament_Active().call()
            is_timed_out = contract.functions.Is_Tournament_Timed_Out().call()
            active_user = contract.functions.Get_Active_User().call()
            time_left = contract.functions.Get_Tournament_Time_Left().call()
            response_data = {
                "is_active": is_active,
                "is_timed_out": is_timed_out,
                "active_user": active_user if active_user != -1 else None,
                "time_left": time_left,
                "current_user": request.user.id if request.user.is_authenticated else None,
                "is_current_user_active": request.user.is_authenticated and active_user == request.user.id
            }
            if is_timed_out:
                try:
                    self.cancel_tournament(request)
                    response_data["message"] = "Timed-out tournament was automatically cancelled"
                    response_data["is_active"] = False
                    response_data["active_user"] = None
                except Exception as e:
                    response_data["warning"] = f"Tournament is timed out but could not be cancelled automatically: {str(e)}"
            return Response(response_data, status=200)
        except Exception as e:
            return Response({"error": f"Error checking tournament status: {e}"}, status=500)
    
    def get(self, request):
        action = request.query_params.get('action', '')
        if action == 'check_status':
            return self.check_tournament_status(request)
        else:
            return Response({"error": "Invalid action specified"}, status=400)