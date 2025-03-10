from django.shortcuts import redirect, render

from django.contrib.auth import get_user_model
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework import status
from .serilaizer import UserRegisterSerializer, LoginUserSerializer , TwoFactorSetupSerializer,TwoFactorVerifySerializer,TwoFactorLoginSerializer,LoginUserSerializer,UserUpdateSerializer
from .utils import send_otp_email
from .models import OneTimePassword ,Myuser
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes ,api_view
from rest_framework_simplejwt.tokens import RefreshToken 
from rest_framework_simplejwt.views import TokenObtainPairView ,TokenBlacklistView, TokenRefreshView
from rest_framework.views import APIView
from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
from django_otp.plugins.otp_totp.models import TOTPDevice
from django_otp import devices_for_user
import qrcode
import io
import base64
from django.conf import settings
import requests
from django.core.files.base import ContentFile
from django.http import HttpResponseRedirect
from django.conf import settings

# Create your views here.


class RegisterUserView(GenericAPIView):
    serializer_class = UserRegisterSerializer

    def post(self, request):
        user_data = request.data
        serializer = self.serializer_class(data=user_data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            user = serializer.data
            send_otp_email(user['email'])
            print(user)
            return Response({
                'data': user,
                'status': f'hi  thansk for signing up '
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)  
    
class VerifyUserEmail(GenericAPIView):
    def post(self, request):
        otpcode = request.data.get('otp')
        try:
            user_code_obj = OneTimePassword.objects.get(code=otpcode)
            user = user_code_obj.user
            if not user.is_verified:
                user.is_verified = True
                user.save()
                return Response({
                    'status': 'Email verified successfully'
                }, status=status.HTTP_200_OK)
            return Response({'status': 'Email already verified'}, status=status.HTTP_204_NO_CONTENT)
        except OneTimePassword.DoesNotExist:
            user_code_obj.delete()
            return Response({'status': 'Invalid OTP'}, status=status.HTTP_404_NOT_FOUND)

# class LoginUserView(GenericAPIView):
#     serializer_class = LoginUserSerializer 
#     def post(self, request): 
#         serializer = self.serializer_class(data=request.data, context={'request':request})
#         serializer.is_valid(raise_exception=True)
#         return Response(serializer.data, status=status.HTTP_200_OK)
    
class TestAutheticationView(GenericAPIView):
    @permission_classes([IsAuthenticated])
    def get(self, request):
        user = UserRegisterSerializer(request.user)    
        return Response(user.data)



class CustomTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        # print(request.data)
        # request.data['refresh'] = request.get('refresh_token')
        return super().post(request, *args, **kwargs)

# class MyTokenObtainPairView(TokenObtainPairView):
#     def post(self, request, *args, **kwargs):
#         response = super().post(request, *args, **kwargs)
#         if response.status_code == status.HTTP_200_OK:
#             refresh_token = response.data.get('refresh')
#             response.set_cookie(
#                 'refresh_token',         
#                 refresh_token,          
#                 httponly=True,          
#                 samesite='Strict',      
#                 path='/',
#                 #secure=True,
#             )
#             response.data.pop('refresh', None)
#         return response

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                return Response(
                    {'message': 'Successfully logged out'}, 
                    status=status.HTTP_200_OK
                )
                
            else:
                return Response(
                    {'error': 'Refresh token is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )



#############################################################################

# class TwoFactorSetupView(GenericAPIView):
#    permission_classes = [IsAuthenticated]
#    serializer_class = TwoFactorSetupSerializer

#    def get(self, request):
#        TOTPDevice.objects.filter(user=request.user).delete()
#        device = TOTPDevice.objects.create(user=request.user, confirmed=False)
       
#        qr = qrcode.QRCode(version=1, box_size=10, border=5)
#        qr.add_data(device.config_url)
#        qr.make(fit=True)
       
#        img = qr.make_image()
#        buffer = io.BytesIO()
#        img.save(buffer, format='PNG')
#        qr_code = base64.b64encode(buffer.getvalue()).decode()
       
#        return Response({
#            'qr_code': f'data:image/png;base64,{qr_code}',
#            'secret_key': device.key
#        })

# class TwoFactorVerifyView(GenericAPIView):
#    permission_classes = [IsAuthenticated]
#    serializer_class = TwoFactorVerifySerializer 

#    def post(self, request):
#        serializer = self.serializer_class(data=request.data)
#        serializer.is_valid(raise_exception=True)
       
#        device = next(devices_for_user(request.user), None)
#        if device is None:
#            return Response({'error': '2FA not set up'}, status=400)
           
#        if device.verify_token(serializer.validated_data['token']):
#            device.confirmed = True
#            device.save()
#            return Response({'message': '2FA enabled successfully'})
           
#        return Response({'error': 'Invalid token'}, status=400)

class TwoFactorLoginView(GenericAPIView):
   serializer_class = TwoFactorLoginSerializer

   def post(self, request):
       serializer = self.serializer_class(data=request.data)
       serializer.is_valid(raise_exception=True)
       
       user = serializer.validated_data['user']
       tokens = user.token()
       
       
       response =Response({
           'access': tokens['access'],
           'refresh': tokens['refresh']
       })
       response.set_cookie(
                    'refresh_token',
                    tokens['refresh'],
                   httponly=False,    #hna rani bdlt hadi l false hit makhlitinish n9rayha yasahbi kifach ghansiftolk bla permission dyal n9ra
                    samesite='Lax',   # Use 'Lax' for HTTP testing
                    path='/',
                    secure=False,     # Works with HTTP
                    max_age=60 * 60 * 24 * 7,
                    domain=settings.HOST_IP
                )
       response.data.pop('refresh', None)
       return response

class LoginView(GenericAPIView):
   serializer_class = LoginUserSerializer

   def post(self, request):
       serializer = self.serializer_class(data=request.data, context={'request': request})
       serializer.is_valid(raise_exception=True)
       
       user = serializer.validated_data['user']
       device = next(devices_for_user(user), None)
       
       if device and device.confirmed:
           return Response({
               'requires_2fa': True,
               'user_id': user.id
           }, status=202)
           
       tokens = user.token()
       response =Response(tokens)

       response.set_cookie(
                    'refresh_token',
                    tokens['refresh'],
                   httponly=False,    #hna
                    samesite='Lax',   # Use 'Lax' for HTTP testing
                    path='/',
                    secure=False,     # Works with HTTP
                    max_age=60 * 60 * 24 * 7,
                    domain=settings.HOST_IP
                )


       response.data.pop('refresh', None)

       return response


class EnableTwoFactorView(GenericAPIView):
   permission_classes = [IsAuthenticated]

   def get(self, request):
       """Generate QR code and start 2FA setup"""
       # Delete any existing devices
       TOTPDevice.objects.filter(user=request.user).delete()
       
       # Create new device
       device = TOTPDevice.objects.create(
           user=request.user,
           confirmed=False,
           name="Default"
       )

       # Generate QR code
       qr = qrcode.QRCode(version=1, box_size=10, border=5)
       qr.add_data(device.config_url)
       qr.make(fit=True)
       
       img = qr.make_image()
       buffer = io.BytesIO()
       img.save(buffer, format='PNG')
       qr_code = base64.b64encode(buffer.getvalue()).decode()

       return Response({
           'qr_code': f'data:image/png;base64,{qr_code}',
           'secret_key': device.key
       })

   def post(self, request):
    token = request.data.get('token')
    if not token:
        return Response({'error': 'Token required'}, status=400)

    # Get the specific device with the correct key
    device = TOTPDevice.objects.filter(
        user=request.user,
        confirmed=False,
        key=request.data.get('secret_key')  # Add this to your frontend request
    ).first()

    if not device:
        return Response({'error': 'Need to setup 2FA first'}, status=400)

    if device.verify_token(token):
        device.confirmed = True
        device.save()
        user=request.user
        user.is_2fa_enabled = True
        user.save()
        return Response({'message': '2FA enabled successfully'})

    return Response({'error': 'Invalid token'}, status=400)

   def delete(self, request):
       """Disable 2FA"""
       user=request.user
       user.is_2fa_enabled = False
       devices = TOTPDevice.objects.filter(user=request.user)
       if devices.exists():
           devices.delete()
           return Response({'message': '2FA disabled'})
       return Response({'message': '2FA not enabled'})
   
##############################################################################################################

class auth42(GenericAPIView):
    def get(self,request):
        auth_url = (
            f"https://api.intra.42.fr/oauth/authorize"
            f"?client_id={settings.CLIENT_ID}"
            f"&redirect_uri={settings.REDIRECT_URI}"
            f"&response_type=code"
        )
        return redirect(auth_url)



class Callback(GenericAPIView):
    
    def get(self, request):
        code = request.GET.get('code')
        if not code:
            redirect_url = f"{settings.FRONTEND_URL}?error=Missing authorization code"
            return Response(
            status=status.HTTP_302_FOUND,
            # {"error": f"Database error: {str(e)}"},
            headers={'Location': redirect_url}
            )
            # return Response({"error": "Missing authorization code"}, status=400)

        # Prepare token request parameters
        token_params = {
            "grant_type": "authorization_code",
            "client_id": settings.CLIENT_ID,
            "client_secret": settings.CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.REDIRECT_URI
        }

        try:
            # Exchange code for token
            response = requests.post(
                "https://api.intra.42.fr/oauth/token",
                data=token_params
            )
            response.raise_for_status()
            token_data = response.json()
            
            # Process token data here
            access_token = token_data.get('access_token')
            refresh_token = token_data.get('refrech_token')
            
            #return Response({"access_token": access_token, "refresh_token": refresh_token}, status=200)
        except requests.exceptions.RequestException as e:
            redirect_url = f"{settings.FRONTEND_URL}?error=auth_failed"
            return Response(
                status=status.HTTP_302_FOUND,
                headers={'Location': redirect_url}
            )
        try:
            headers = {
                "Authorization": f"Bearer {access_token}"
            }
            
            # For 42 API user data
            user_response = requests.get(
                "https://api.intra.42.fr/v2/me",
                headers=headers
            )
            user_response.raise_for_status()
            user_data = user_response.json()
            print(user_data.get('email'))
            intra42_id = user_data.get('id')
            email = user_data.get('email')
            #image_url=user_data.get('image_link')
            image_data = user_data.get('image', {})
            image_versions = image_data.get('versions', {})
            image_url = image_versions.get('medium')
            print(image_url)

            if not intra42_id or not email:
                redirect_url = f"{settings.FRONTEND_URL}?error=Missing user information from provider"
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    headers={'Location': redirect_url}
                )

        # Check if user exists or create new one
            try:
                user = Myuser.objects.get(id=intra42_id)
                tokens = user.token()
                print(user.first_name)
                device = next(devices_for_user(user), None)
                if device and device.confirmed:
                    redirect_url = f"{settings.FRONTEND_URL}2fa?user_id={user.id}"
                    response = HttpResponseRedirect(redirect_url)
                    return response
                #     return Response({
                #     'requires_2fa': True,
                #     'user_id': user.id
                # }, status=202)
                redirect_url = f"{settings.FRONTEND_URL}?token={tokens['access']}"
                response = HttpResponseRedirect(redirect_url)
                response.set_cookie(
                    'refresh_token',
                    tokens['refresh'],
                    httponly=False,   #hna
                    samesite='Lax',   # Use 'Lax' for HTTP testing
                    path='/',
                    secure=False,     # Works with HTTP
                    max_age=60 * 60 * 24 * 7,
                    domain=settings.HOST_IP
                    )
                return response
            except Myuser.DoesNotExist:
            # Create new user with 42's ID
                try:
                    user = Myuser.objects.create(
                        id=intra42_id,
                        email=email,
                        username=generate_unique_username(user_data.get('login','')),
                        first_name=user_data.get('first_name',''),
                        last_name=user_data.get('last_name',''),
                        
                    # Add other fields from user_data as needed
                    )

                    if image_url:
                            response = requests.get(image_url)
                            if response.status_code == 200:
                                img_name = f'avatar_{user.id}.jpg'
                                #img_io = io.BytesIO(response.content)
                                user.avatar.save(
                                    img_name,
                                    ContentFile(response.content),
                                    save=True
                                )
                    tokens = user.token()
                    redirect_url = f"{settings.FRONTEND_URL}?token={tokens['access']}"
                    response = HttpResponseRedirect(redirect_url)
                    response.set_cookie(
                    'refresh_token',
                    tokens['refresh'],
                   httponly=False,    #hna
                    samesite='Lax',   # Use 'Lax' for HTTP testing
                    path='/',
                    secure=False,     # Works with HTTP
                    max_age=60 * 60 * 24 * 7,
                    domain=settings.HOST_IP
                    )
                    return response

                except Exception as e:
                    redirect_url = f"{settings.FRONTEND_URL}?error=user_creation_failed"
                    return Response(
                    status=status.HTTP_302_FOUND,
                    data={"error": f"User creation failed: {str(e)}"},
                    headers={'Location': redirect_url}
                    )
            except Exception as e:
                redirect_url = f"{settings.FRONTEND_URL}?errorDatabase error :{str(e)}"
                return Response(
                status=status.HTTP_302_FOUND,
                # {"error": f"Database error: {str(e)}"},
                headers={'Location': redirect_url}
                )
                # return Response({"error": f"Database error: {str(e)}"}, status=400)
       
        except requests.exceptions.RequestException as e:
            redirect_url = f"{settings.FRONTEND_URL}?User data fetch failed: {str(e)}"
            return Response(
            status=status.HTTP_302_FOUND,
            # {"error": f"Database error: {str(e)}"},
            headers={'Location': redirect_url}
            )
            # return Response({"error": f"User data fetch failed: {str(e)}"}, status=400)
        
def generate_unique_username(base_username):
    if not Myuser.objects.filter(username=base_username).exists():
        return base_username
    counter = 1
    while True:
        new_username = f"{base_username}_{counter}"
        if not Myuser.objects.filter(username=new_username).exists():
            return new_username
        counter += 1

            

class SearchView(GenericAPIView):
    permission_classes=[IsAuthenticated]
    def post(self,request):
        search=request.data.get('search')
        users=Myuser.objects.filter(username__icontains=search)

        if not users:
            return Response({"error": "No users found"}, status=404)
        users = UserRegisterSerializer(users, many=True).data
        
        return Response({"users": users}, status=200)
    

class UpdateView(GenericAPIView):
    permission_classes=[IsAuthenticated]
    ALLOWED_FIELDS = {'first_name', 'last_name', 'avatar'}
    def put(self,request):
        unauthorized_fields = set(request.data.keys()) - self.ALLOWED_FIELDS
        
        if unauthorized_fields:
            return Response(
                {
                    'error': 'Cannot update these fields',
                    'unauthorized_fields': list(unauthorized_fields)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        user=request.user
        print(user.username)
        data=request.data
        serializer=UserRegisterSerializer(user,data=data,partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data,status=200)