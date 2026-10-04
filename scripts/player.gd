extends CharacterBody3D
class_name RunnerPlayer

signal hit_obstacle
signal collected_coin

const LANES := [-2.6, 0.0, 2.6]
const GRAVITY := 24.0
const JUMP_VELOCITY := 10.5
const LANE_SPEED := 12.0
const FORWARD_SPEED := 15.0

var lane := 1
var target_x := 0.0
var speed := FORWARD_SPEED
var alive := true
var invulnerable := false
var slide_time := 0.0
var touch_start := Vector2.ZERO

func _ready() -> void:
	target_x = LANES[lane]

func _physics_process(delta: float) -> void:
	if not alive:
		return
	velocity.z = -speed
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = -0.5
	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = JUMP_VELOCITY
	if Input.is_action_just_pressed("slide"):
		slide_time = 0.55
	if slide_time > 0.0:
		slide_time -= delta
	target_x = LANES[lane]
	global_position.x = move_toward(global_position.x, target_x, LANE_SPEED * delta)
	move_and_slide()
	if global_position.y < -4.0:
		hit_obstacle.emit()

func shift_lane(direction: int) -> void:
	lane = clampi(lane + direction, 0, 2)

func hit() -> void:
	if invulnerable or not alive:
		return
	hit_obstacle.emit()

func set_invulnerable(value: bool) -> void:
	invulnerable = value

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			touch_start = event.position
		else:
			_handle_swipe(event.position - touch_start)
	elif event is InputEventScreenDrag:
		var delta := event.relative
		if abs(delta.x) > abs(delta.y) and abs(delta.x) > 12.0:
			shift_lane(1 if delta.x > 0.0 else -1)

func _handle_swipe(delta: Vector2) -> void:
	if delta.length() < 40.0:
		return
	if abs(delta.x) > abs(delta.y):
		shift_lane(1 if delta.x > 0.0 else -1)
	elif delta.y < 0.0 and is_on_floor():
		velocity.y = JUMP_VELOCITY
	elif delta.y > 0.0:
		slide_time = 0.55
