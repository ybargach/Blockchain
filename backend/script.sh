#!/bin/bash

sleep 5
sed -i 's/\r$//' manage.py script.sh
python manage.py makemigrations
python manage.py migrate
daphne  -b 0.0.0.0 -p 8000 backend.asgi:application