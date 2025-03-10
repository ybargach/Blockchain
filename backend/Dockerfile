FROM python:3.12.7-slim
# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1


RUN apt-get update && \
    apt-get install -y postgresql-client curl libpq-dev gcc python3-dev

    
WORKDIR /backend/   
    
COPY /backend/src/backend .
    
RUN mkdir -p /backend/media/user_avatars
    
COPY /backend/requirements.txt .

#COPY  script.sh  .



RUN chmod +x  script.sh


RUN pip install --no-cache-dir -r requirements.txt


# RUN python manage.py makemigrations
# RUN python manage.py migrate

ENTRYPOINT ["bash","script.sh"]



 