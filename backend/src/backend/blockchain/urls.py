from django.urls import path
from . import views

urlpatterns = [
    path('save_data/', views.SaveDataToBlockchainAPIView.as_view(), name='save_data'),
    path('process_data/', views.GetAllScoresAPIView.as_view(), name='process_data'),
    path('cancel/', views.GetCancel.as_view(), name='cancel'),
    path('balance/', views.GetBalance.as_view(), name='balance'),
    path('', views.SaveDataToBlockchainAPIView.as_view(), name='check_status'),
]


