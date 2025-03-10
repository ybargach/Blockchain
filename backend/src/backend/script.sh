#!/bin/bash

if [ ! -f "/backend/blockchain/contract/Compile_file" ]; then
    python /backend/blockchain/contract/Compile.py & wait
fi

if [ ! -f "/backend/blockchain/contract/Deploy_file" ]; then
    python /backend/blockchain/contract/Deploy.py & wait
fi

python manage.py makemigrations
python manage.py migrate
daphne  -b 0.0.0.0 -p 8000 backend.asgi:application




