from django.urls import path, include  # Use include to add app URLs

urlpatterns = [
    path('api/', include('blockchain_project.urls')),
]
