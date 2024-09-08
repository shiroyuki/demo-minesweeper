FROM python:3.11

RUN pip3 install gunicorn

WORKDIR /app

ADD requirements.txt .
RUN pip3 install -r requirements.txt

ADD minesweeper ./minesweeper
ADD mspy ./mspy
ADD manage.py .

CMD cp /data/.my_pgpass /data/.pg_service.conf /app \
    && chmod 600 .my_pgpass .pg_service.conf \
    && chown root .my_pgpass .pg_service.conf \
    && python3 manage.py migrate \
    && gunicorn -w 4 -b 0.0.0.0:8000 mspy.wsgi:application