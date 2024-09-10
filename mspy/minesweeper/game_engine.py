import json
import math
from time import time
from typing import List, Optional, Tuple, Dict, Iterable, Set

from django.http import HttpRequest
from django.views.decorators.csrf import csrf_exempt
from pydantic import BaseModel

from minesweeper.common.rest_api_utils import get_authorized_user_id, UnauthenticatedError, respond_error, \
    AccessDeniedError, respond_ok
from minesweeper.models import GameMove, GameSession

ACTIVE = 'active'
CLEARED = 'cleared'
EXPLODED = 'exploded'
FLAGGED = 'flagged'
UNKNOWN = 'unknown'

KNOWN_STATES = [
    CLEARED,
    EXPLODED,
    FLAGGED,
]


class GameInfo(BaseModel):
    id: str
    width: int
    height: int
    mine_density: int
    create_time: int
    state: Optional[str] = None

    @classmethod
    def make(cls, db_model: GameSession):
        return cls(
            id=db_model.id,
            width=db_model.width,
            height=db_model.height,
            mine_density=db_model.mineDensity,
            create_time=db_model.createTime,
            state=db_model.state,
        )


class SimplifiedMove(BaseModel):
    x: int
    y: int
    state: str


class Hint(BaseModel):
    # row-to-column matrix, i.e., array<row, column>
    nearby_mine_count: List[List[int]]


class GameSnapshot(BaseModel):
    info: GameInfo
    moves: List[SimplifiedMove]
    hint: Hint


class Game:
    def __init__(self, info: GameSession):
        self._info = info
        self._moves: Dict[Tuple[int, int], GameMove] = {
            move.to_coordinate(): move
            for move in self._get_moves()
        }
        self._mine_positions = [
            (mine_coordinate['x'], mine_coordinate['y'])
            for mine_coordinate in self._info.mineCoordinates
        ]

    @property
    def info(self):
        return self._info

    def _get_moves(self) -> List[GameMove]:
        sequence: List[GameMove] = []
        known_moves: Set[Tuple[int, int]] = set()

        result: Iterable[GameMove] = GameMove.objects.filter(gameId=self._info.id).order_by('-id')

        for move in result:
            coordinate = move.to_coordinate()

            if coordinate in known_moves:
                continue
            else:
                known_moves.add(coordinate)
                sequence.append(move)

        return sequence

    def _get_hints(self) -> Hint:
        hint = Hint(
            # Fill in the blank
            nearby_mine_count=[
                [0 for _ in range(self._info.width)]
                for __ in range(self._info.height)
            ],
        )

        for mine_position in self._mine_positions:
            column = mine_position[0]
            row = mine_position[1]
            for y in range(max(0, row - 1), min(self._info.height, row + 2)):
                for x in range(max(0, column - 1), min(self._info.height, column + 2)):
                    if (x, y) in self._mine_positions:
                        continue
                    hint.nearby_mine_count[y][x] += 1

        return hint

    def visit(self, move: GameMove) -> bool:
        if self._info.state in KNOWN_STATES:
            return False

        if move.state == FLAGGED or move.state == UNKNOWN:
            move.save()
            self._run_self_evaluate()
        elif (move.x, move.y) in self._mine_positions:
            # Update the state of that position.
            move.state = EXPLODED
            move.save()
            # Update the state of the game.
            self._info.state = EXPLODED
            self._info.save()
        else:
            visited_coordinates: List[Tuple[int, int]] = list()
            self._clear_area(move.x, move.y, visited_coordinates)
            self._run_self_evaluate()

        return True

    def _clear_area(self, x: int, y: int, visited_coordinates: List[Tuple[int, int]], depth: int = 0):
        coordinate = (x, y)
        move: Optional[GameMove] = self._moves.get(coordinate)

        # Evaluate the given coordinate.
        if coordinate in visited_coordinates \
                or coordinate in self._mine_positions \
                or (move and move.state in KNOWN_STATES):
            return

        visited_coordinates.append(coordinate)

        if move:
            move.state = CLEARED
        else:
            move = GameMove(
                gameId=self._info.id,
                userId=self._info.userId,
                x=x,
                y=y,
                state=CLEARED,
                createTime=math.floor(time()),
            )
        move.save()

        # Evaluate the surrounding coordinates.
        if x - 1 >= 0:
            self._clear_area(x - 1, y, visited_coordinates, depth + 1)

        if x + 1 < self._info.width:
            self._clear_area(x + 1, y, visited_coordinates, depth + 1)

        if y - 1 >= 0:
            self._clear_area(x, y - 1, visited_coordinates, depth + 1)

        if y + 1 < self._info.height:
            self._clear_area(x, y + 1, visited_coordinates, depth + 1)

    def _run_self_evaluate(self):
        self._info.state = self._compute_game_state()
        self._info.save()

    def _compute_game_state(self):
        cleared_count = 0
        correctly_flagged_count = 0

        for coordinate, move in self._moves.items():
            if move.state == CLEARED:
                cleared_count += 1
            elif move.state == FLAGGED:
                if coordinate in self._mine_positions:
                    correctly_flagged_count += 1
                else:
                    cleared_count += 1
            elif move.state == EXPLODED:
                return EXPLODED
            # end: if
        # end: for

        total_square_count = self._info.width * self._info.height
        if cleared_count + correctly_flagged_count == total_square_count:
            return CLEARED
        else:
            return ACTIVE

    def get_snapshot(self) -> GameSnapshot:
        return GameSnapshot(
            info=GameInfo.make(self.info),
            moves=[
                SimplifiedMove(x=move.x, y=move.y, state=move.state)
                for move in self._get_moves()
            ],
            hint=self._get_hints(),
        )

    @classmethod
    def with_id(cls, id: str):
        session = GameSession.objects.get(id=id)

        if session is None:
            return None
        else:
            return cls(session)


def get_snapshot(request: HttpRequest, session_id: str):
    if request.method != 'GET':
        return respond_error(405, 'Method not allowed')

    try:
        user_id = get_authorized_user_id(request, 'game')
    except UnauthenticatedError:
        return respond_error(401)
    except AccessDeniedError as e:
        return respond_error(403, e.args[0])

    game: Optional[Game] = Game.with_id(session_id)

    if not game:
        return respond_error(404)
    elif game.info.userId != user_id:
        return respond_error(404)  # Fake HTTP 404 to prevent scanning.
    else:
        return respond_ok(game.get_snapshot().model_dump())


@csrf_exempt
def visit(request: HttpRequest, session_id: str):
    if request.method != 'POST':
        return respond_error(405, 'Method not allowed')

    try:
        user_id = get_authorized_user_id(request, 'game')
    except UnauthenticatedError:
        return respond_error(401)
    except AccessDeniedError as e:
        return respond_error(403, e.args[0])

    game: Optional[Game] = Game.with_id(session_id)

    if not game:
        return respond_error(404)
    elif game.info.userId != user_id:
        return respond_error(404)  # Fake HTTP 404 to prevent scanning.

    entry = json.loads(request.body)
    move = GameMove(
        gameId=session_id,
        userId=user_id,
        x=entry['x'],
        y=entry['y'],
        state=entry.get('state'),
        createTime=math.floor(time()),
    )

    if game.visit(move):
        return respond_ok(game.get_snapshot().model_dump())
    else:
        return respond_error(409, f'game_concluded/{game.info.state}')
