import random 
from django.core.mail import EmailMessage
from .models import Myuser , OneTimePassword
from django.conf import settings

def generate_otp():
    otp =""
    for i in range(6):
        otp += str(random.randint(1,9))
    return otp
    
def send_otp_email(email):
    Subject = "Your OTP for email verification"
    otp_code=generate_otp()
    print(otp_code)
    user = Myuser.objects.get(email=email)
    current_site="myAuth.com"
    email_body = f'Hi {user.first_name},\n\nYour OTP for email verification is {otp_code}.\n\nThanks,\nTeam myAuth'
    from_email=settings.DEFAULT_FROM_EMAIL
    OneTimePassword.objects.create(user=user, code=otp_code)
    d_mail=EmailMessage(subject=Subject, body=email_body, from_email=from_email, to=[email])
    d_mail.send(fail_silently=True)
    