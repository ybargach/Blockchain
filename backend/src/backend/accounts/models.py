from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager,PermissionsMixin 
from django.core.validators import ValidationError
from django.utils.translation import gettext_lazy as _
from django.core.validators import validate_email
from rest_framework_simplejwt.tokens import RefreshToken
from .manager import MyUserManager
from django_otp.plugins.otp_totp.models import TOTPDevice
import os
from django.utils import timezone
    

def user_avatar_path(instance, filename):
    # File will be uploaded to MEDIA_ROOT/user_avatars/user_id/filename
    return os.path.join('user_avatars', str(instance.id), filename)

class Myuser(AbstractUser,PermissionsMixin):
    email = models.EmailField(max_length=255,verbose_name=_("email"),unique=True)
    username = models.CharField(verbose_name=_("username"), max_length=100, unique=True)
    first_name = models.CharField(verbose_name=_("first_name"), max_length=100)
    last_name = models.CharField(verbose_name=_("last-name"), max_length=100)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)
    is_towfactor = models.BooleanField(default=False)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(default=timezone.now)
    avatar = models.ImageField(upload_to=user_avatar_path, 
                             default='default_avatar/default.png',
                             blank=True,
                             verbose_name=_("avatar"))

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name',]

    objects = MyUserManager()

    def __str__(self):
        return self.email
    
    
    @property
    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'
    
    def token(self):
        refresh = RefreshToken.for_user(self)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token)
        }

class OneTimePassword(models.Model):
    user = models.OneToOneField(Myuser, on_delete=models.CASCADE)
    code=models.CharField(max_length=6, unique=True)
        
    def __str__(self):
        return f"{self.user.first_name}--passcode"
    

