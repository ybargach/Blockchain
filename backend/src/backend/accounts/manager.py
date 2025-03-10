from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager,PermissionsMixin 
from django.core.validators import ValidationError
from django.utils.translation import gettext_lazy as _
from django.core.validators import validate_email
from rest_framework_simplejwt.tokens import RefreshToken




class MyUserManager(BaseUserManager):
    def email_validator(self, email):
        try:
            validate_email(email)
        except ValidationError :
            raise valueError(_('Invalid email address'))
    
    def create_user(self, email, username, first_name, last_name, password, **extra_fields): 
        if email:
            email = self.normalize_email(email)
            self.email_validator(email)
        else:
            raise ValueError(_('The Email field must be set'))
        if not username:
            raise ValueError(_('The username field must be set'))
        if not first_name:
            raise ValueError(_('The first_name field must be set'))
        if not last_name:
            raise ValueError(_('The last_name field must be set'))
        user = self.model(email=email, username=username, first_name=first_name, last_name=last_name,**extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user