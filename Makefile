PG_SERVICE_CONF_FILE=mspy/.pg_service.conf
PG_PASSWORD_FILE=mspy/.my_pgpass

DOCKER_DATA_PATH=data
DOCKER_PG_SERVICE_CONF_FILE=$(DOCKER_DATA_PATH)/.pg_service.conf
DOCKER_PG_PASSWORD_FILE=$(DOCKER_DATA_PATH)/.my_pgpass

.PHONY: init
init:
	docker compose up -d psql

.PHONY: db-init
db-init:
	# Create the database if needed
	source .env \
		&& PGPASSWORD=$${POSTGRES_PASSWORD} psql --host=$${POSTGRES_HOST} --port=$${POSTGRES_PORT} --dbname=postgres --user=$${POSTGRES_USER} -c 'CREATE DATABASE minesweeper' || echo 'The DB might have already existed.'
	# Create the config files for local development.
	source .env \
		&& echo "[primary]" > $(PG_SERVICE_CONF_FILE) \
		&& echo "host=$${POSTGRES_HOST}" >> $(PG_SERVICE_CONF_FILE) \
		&& echo "user=$${POSTGRES_USER}" >> $(PG_SERVICE_CONF_FILE) \
		&& echo "dbname=minesweeper" >> $(PG_SERVICE_CONF_FILE) \
		&& echo "port=$${POSTGRES_PORT}" >> $(PG_SERVICE_CONF_FILE) \
		&& chmod 600 $(PG_SERVICE_CONF_FILE) \
		&& echo "$${POSTGRES_HOST}:$${POSTGRES_PORT}:minesweeper:$${POSTGRES_USER}:$${POSTGRES_PASSWORD}" > $(PG_PASSWORD_FILE) \
		&& chmod 600 $(PG_PASSWORD_FILE)
	# Create the config files for the Docker development.
	source .env \
		&& echo "[primary]" > $(DOCKER_PG_SERVICE_CONF_FILE) \
		&& echo "host=psql" >> $(DOCKER_PG_SERVICE_CONF_FILE) \
		&& echo "user=$${POSTGRES_USER}" >> $(DOCKER_PG_SERVICE_CONF_FILE) \
		&& echo "dbname=minesweeper" >> $(DOCKER_PG_SERVICE_CONF_FILE) \
		&& echo "port=5432" >> $(DOCKER_PG_SERVICE_CONF_FILE) \
		&& chmod 600 $(DOCKER_PG_SERVICE_CONF_FILE) \
		&& echo "psql:5432:minesweeper:$${POSTGRES_USER}:$${POSTGRES_PASSWORD}" > $(DOCKER_PG_PASSWORD_FILE) \
		&& chmod 600 $(DOCKER_PG_PASSWORD_FILE)

.PHONY: db-destroy
db-destroy:
	source .env \
		&& PGPASSWORD=$${POSTGRES_PASSWORD} psql --host=$${POSTGRES_HOST} --port=$${POSTGRES_PORT} --dbname=postgres --user=$${POSTGRES_USER} -c 'DROP DATABASE minesweeper' || echo 'The DB might have been deleted.'

.PHONY: db-shell
db-shell:
	source .env \
		&& PGPASSWORD=$${POSTGRES_PASSWORD} psql --host=$${POSTGRES_HOST} --port=$${POSTGRES_PORT} --dbname=minesweeper --user=$${POSTGRES_USER}

##### Docker #####

.PHONY: docker-run
docker-run:
	@docker compose build frontend backend
	@docker compose up -d

.PHONY: docker-start
docker-start: init db-init docker-run

.PHONY: docker-superuser
docker-superuser:
	@docker compose exec -it backend python manage.py createsuperuser

##### Local #####

.PHONY: run-frontend
run-frontend:
	cd msweb && npm start

.PHONY: shell
shell:
	source .venv/bin/activate \
		&& source .env \
		&& cd mspy \
		&& export PGSERVICEFILE=.pg_service.conf \
		&& export PGPASSFILE=.my_pgpass \
		&& export JWT_SECRET=$${JWT_SECRET} \
		&& python3 manage.py makemigrations \
		&& python3 manage.py migrate \
		&& python3 manage.py shell

.PHONY: superuser
superuser:
	source .venv/bin/activate \
		&& source .env \
		&& cd mspy \
		&& export PGSERVICEFILE=.pg_service.conf \
		&& export PGPASSFILE=.my_pgpass \
		&& export JWT_SECRET=$${JWT_SECRET} \
		&& python3 manage.py createsuperuser

.PHONY: superuser-default
superuser-default:
	source .venv/bin/activate \
		&& source .env \
		&& cd mspy \
		&& export PGSERVICEFILE=.pg_service.conf \
		&& export PGPASSFILE=.my_pgpass \
		&& export JWT_SECRET=$${JWT_SECRET} \
		&& python3 manage.py createsuperuser --username root --email "root@dev.local"

.PHONY: run-backend
run-backend:
	source .venv/bin/activate \
		&& source .env \
		&& cd mspy \
		&& export PGSERVICEFILE=.pg_service.conf \
		&& export PGPASSFILE=.my_pgpass \
		&& export JWT_SECRET=$${JWT_SECRET} \
		&& python3 manage.py makemigrations \
		&& python3 manage.py migrate \
		&& python3 manage.py runserver