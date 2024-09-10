import json
from typing import Optional, TypeVar, Type, Callable, Dict, Any, List

from django.forms import model_to_dict
from django.http import HttpRequest, JsonResponse, HttpResponse
from imagination import container
from jwt import ExpiredSignatureError

from minesweeper.common.token_service import TokenService

token_service: TokenService = container.get(TokenService)


class AccessDeniedError(RuntimeError):
    pass


class UnauthenticatedError(RuntimeError):
    pass


def decode_bearer_token(request: HttpRequest):
    """ Decode the bearer token """
    bearer_token = request.headers.get('authorization')

    if not bearer_token:
        return None
    else:
        try:
            return token_service.decode_token(bearer_token[7:])
        except ExpiredSignatureError as e:
            return None


def get_authorized_user_id(request: HttpRequest, scope: str) -> int:
    """ Get the user ID from the incoming bearer token and perform a simple scope check """
    claims = decode_bearer_token(request)
    if claims is None:
        raise UnauthenticatedError()
    elif claims['scope'] == scope:
        return int(claims['sub'])
    else:
        raise AccessDeniedError('invalid_scope')


def respond_ok(obj):
    """ Simply make a JSON response """
    response = JsonResponse(obj, safe=False)
    if isinstance(obj, (list, dict, set, tuple)):
        response.headers['X-Size'] = len(obj)  # For debuggin purpose
    return response


def respond_error(status: int, error_message: Optional[str] = None):
    """ Simply make an error JSON response, except HTTP 401 """
    if status == 401:
        return HttpResponse('', status=401)
    else:
        return JsonResponse({'error': error_message}, status=status)


T = TypeVar('T')


def handle_root_api_request(request: HttpRequest,
                            cls: Type[T],
                            map_dict_to_object: Callable[[Dict[str, Any]], T],
                            sorting_order: List[str],
                            reiterate_list: Optional[Callable[[List[T]], List[T]]]):
    """ Handle all requests at the root level of the rest API, e.g., "/api/<resource_type>/".

        This includes listing all resources owned by the authenticated user and creating a new resource.
    """
    try:
        user_id = get_authorized_user_id(request, 'game')
    except UnauthenticatedError:
        return respond_error(401)
    except AccessDeniedError as e:
        return respond_error(403, e.args[0])

    if request.method == 'GET':
        filters = {
            k[7:]: v
            for k, v in request.GET.items()
            if k.startswith('filter_') and v
        }

        obj_list = [obj for obj in cls.objects.filter(userId=user_id, **filters).order_by(*sorting_order)]

        if reiterate_list:
            obj_list = reiterate_list(obj_list)

        return respond_ok([model_to_dict(obj) for obj in obj_list])
    elif request.method == 'POST':
        request_body = json.loads(request.body)
        try:
            new_obj = map_dict_to_object(request_body)
            new_obj.save()

            return respond_ok(model_to_dict(new_obj))
        except KeyError as e:
            return respond_error(400, f'invalid_request/{e.args[0]}')
    else:
        return respond_error(405, 'method_not_allowed')


def handle_api_request_for_one_resource(request: HttpRequest,
                                        cls: Type[T],
                                        id: Any,
                                        map_dict_to_object: Optional[Callable[[T, Dict[str, Any]], T]]):
    """ Handle all requests for one resource, identified by "id", e.g., "/api/<resource_type>/<id>".

        This includes fetching ONE resource by ID, updating it (partial replacement), and deleting it.
    """
    try:
        user_id = get_authorized_user_id(request, 'game')
    except UnauthenticatedError:
        return respond_error(401)
    except AccessDeniedError as e:
        return respond_error(403, e.args[0])

    obj = cls.objects.get(id=id)

    if obj is None:
        return respond_error(404, 'not_found')

    if obj.userId != user_id:
        return respond_error(404, 'not_found')  # Fake 404 to prevent scanning.

    if request.method == 'GET':
        if obj:
            return respond_ok(model_to_dict(obj))
        else:
            return respond_error(404, 'not_found')
    elif request.method == 'PUT':
        if map_dict_to_object is None:
            return respond_error(405, 'method_not_allowed')

        request_body = json.loads(request.body)
        updated_obj = map_dict_to_object(obj, request_body)
        updated_obj.save()

        return respond_ok(model_to_dict(obj))
    elif request.method == 'DELETE':
        obj.delete()
        return HttpResponse(content='', status=204)
    else:
        return respond_error(405, 'method_not_allowed')