from time import time
from uuid import uuid4
from django.db import models


class GameSession(models.Model):
    id = models.CharField(primary_key=True, default=str(uuid4()))
    user_id = models.IntegerField(db_column='user_id', name='userId', null=False, db_index=True)
    width = models.IntegerField(null=False)  # in square
    height = models.IntegerField(null=False)  # in square
    mine_density = models.SmallIntegerField(db_column='mine_density', name='mineDensity', null=False)  # Used to initially calculate the number of mines.
    mine_coordinates = models.JSONField(db_column='mine_coordinates', name='mineCoordinates', default=list)  # The position of the mines as an array of {x: int, y: int}.
    state = models.CharField(null=True)
    create_time = models.IntegerField(db_column='create_time', name='createTime', null=False, db_index=True, default=time)


class GameMove(models.Model):
    """ Game Move DB Model

        The foreign keys (game_id, user_id) are not set on purpose for the sake of simplcity and performance.
    """
    game_id = models.CharField(db_column='game_id', name='gameId', db_index=True, null=False)
    user_id = models.IntegerField(db_column='user_id', name='userId', null=False)  # NOTE: If we have more time and allow multiple players in the same game session, the user ID will be used to keep tracking who made the move.
    x = models.IntegerField(null=False)
    y = models.IntegerField(null=False)
    state = models.CharField(null=False)
    create_time = models.IntegerField(db_column='create_time', name='createTime', null=False, db_index=True, default=time)
