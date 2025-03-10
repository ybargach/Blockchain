from django.urls import path
from .views import RegisterUserView, VerifyUserEmail, TestAutheticationView  ,LogoutView ,CustomTokenRefreshView
from .views import TwoFactorLoginView,LoginView ,EnableTwoFactorView,auth42, Callback, SearchView,UpdateView



urlpatterns = [
    path('register/', RegisterUserView.as_view(), name='register'),
    path('verify/', VerifyUserEmail.as_view(), name='verify'),
   # path('login/', LoginUserView.as_view(), name='login'),
    path('test/', TestAutheticationView.as_view(), name='test'),
    #path('token/', MyTokenObtainPairView.as_view(), name='token'),
    path('logout/',LogoutView.as_view(),name='logout'),
    path('tokenref/',CustomTokenRefreshView.as_view(),name="reftokcen"),


    #path('2fa/setup/', TwoFactorSetupView.as_view()),
   #path('2fa/verify/', TwoFactorVerifyView.as_view()),
   path('2fa/login/', TwoFactorLoginView.as_view()),
   path('login/', LoginView.as_view()),
   path('2fa/enable/', EnableTwoFactorView.as_view(), name='2fa-enable'),
   path('login42/',auth42.as_view(), name="login42"),
   path('callback/',Callback.as_view(), name="callback"),
   path('search/',SearchView.as_view(), name="search"),
   path('update/',UpdateView.as_view(), name="update"),
   

    
]