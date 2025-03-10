from rest_framework import serializers
from .models import Myuser
from django.contrib.auth import authenticate
from rest_framework.exceptions import AuthenticationFailed
from django_otp import devices_for_user

class UserRegisterSerializer(serializers.ModelSerializer):
    password =  serializers.CharField(max_length=68, min_length=6,write_only=True)
    password2 = serializers.CharField(max_length=68, min_length=6,write_only=True)
    
    class Meta:
        model = Myuser
        fields = ['id','email','username','first_name','last_name','password','password2','avatar','is_towfactor','is_online']
        
    def validate(self, attrs):
        password=attrs.get('password', '')
        password2=attrs.get('password2', '')
        if password != password2:
            raise serializers.ValidationError({'password': 'passwords must match'})
        
        return attrs
    
    def create(self, validated_data):
        user=Myuser.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            password=validated_data['password']
            
        )
        if 'avatar' in validated_data:
            user.avatar = validated_data['avatar']
            user.save()
        return user
        
class LoginUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(max_length=255, min_length=6)
    password = serializers.CharField(max_length=68, min_length=6, write_only=True)
    full_name = serializers.CharField(max_length=255, read_only=True)
    access_token = serializers.CharField(max_length=255, read_only=True)
    refresh_token = serializers.CharField(max_length=255, read_only=True)
    class Meta:
        model = Myuser
        fields = ['email','password','full_name','access_token','refresh_token']
        
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        request=self.context.get('request')
        user = authenticate(request, email=email, password=password)
        if not user:
            raise AuthenticationFailed(f' Invalid credentials, try again')
        #verfiy the email    
        #if not user.is_verified:
            #raise AuthenticationFailed('Account is not active, please verify your email')
        #user_tokens=user.token()
        return {
        'user': user,
        'email': user.email,
        'full_name': user.get_full_name,
        #'access_token': str(user_tokens.get('access')),
        #'refresh_token': str(user_tokens.get('refresh'))
        }

##############################


class TwoFactorSetupSerializer(serializers.Serializer):
   qr_code = serializers.CharField(read_only=True)
   secret_key = serializers.CharField(read_only=True)

class TwoFactorVerifySerializer(serializers.Serializer):
   token = serializers.CharField(min_length=6, max_length=6)
   
class TwoFactorLoginSerializer(serializers.Serializer):
   token = serializers.CharField(min_length=6, max_length=6)
   user_id = serializers.IntegerField()

   def validate(self, attrs):
       user_id = attrs.get('user_id')
       token = attrs.get('token')
       
       try:
           user = Myuser.objects.get(id=user_id)
           device = next(devices_for_user(user), None)
           
           if device is None:
               raise serializers.ValidationError("2FA not set up for this user")
               
           if not device.verify_token(token):
               raise serializers.ValidationError("Invalid token")
               
           attrs['user'] = user
           return attrs
           
       except Myuser.DoesNotExist:
           raise serializers.ValidationError("Invalid user")

# class LoginUserSerializer(serializers.ModelSerializer):
#    email = serializers.EmailField(max_length=255)
#    password = serializers.CharField(max_length=68, write_only=True)
#    full_name = serializers.CharField(read_only=True)
#    access_token = serializers.CharField(read_only=True) 
#    refresh_token = serializers.CharField(read_only=True)

#    class Meta:
#        model = Myuser
#        fields = ['email', 'password', 'full_name', 'access_token', 'refresh_token']

#    def validate(self, attrs):
#        email = attrs.get('email')
#        password = attrs.get('password')
#        request = self.context.get('request')
       
#        user = authenticate(request, email=email, password=password)
       
#        if not user:
#            raise AuthenticationFailed('Invalid credentials')
       
#        #if not user.is_verified:
#            #raise AuthenticationFailed('Email not verified')

#        attrs['user'] = user
#        return attrs


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Myuser
        fields = ['first_name', 'last_name', 'avatar']
        
    def update(self, instance, validated_data):
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        if 'avatar' in validated_data:
            instance.avatar = validated_data['avatar']
        instance.save()
        return instance