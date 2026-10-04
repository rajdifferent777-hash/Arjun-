extends Node3D

var score := 0
var coins := 0
var distance := 0.0
var best_score := 0
var chase_distance := 18.0
var game_over := false
var speed_bonus := 0.0

@onready var player: RunnerPlayer = $Player
@onready var pursuer: MeshInstance3D = $Pursuer
@onready var score_label: Label = $HUD/Score
@onready var info_label: Label = $HUD/Info
@onready var game_over_panel: Control = $HUD/GameOver
@onready var camera: Camera3D = $Camera

func _ready() -> void:
	game_over_panel.visible = false
	info_label.text = "SWIPE  •  MOVE  •  JUMP\nCollect relics. Find the safe lane."
	player.hit_obstacle.connect(player_hit)
	best_score = int(ProjectSettings.get_setting("application/config/version", 0))
	_update_hud()

func _process(delta: float) -> void:
	if game_over:
		return
	distance += player.speed * delta
	score = int(distance * 10.0) + coins * 25
	camera.global_position = player.global_position + Vector3(0.0, 5.2, 9.0)
	camera.look_at(player.global_position + Vector3(0.0, 1.0, -12.0), Vector3.UP)
	pursuer.global_position.z = player.global_position.z + chase_distance
	pursuer.global_position.x = player.global_position.x
	pursuer.scale = Vector3.ONE * (1.0 + sin(Time.get_ticks_msec() * 0.005) * 0.04)
	if chase_distance < 7.0:
		player_hit()
	_update_hud()

func add_coin() -> void:
	coins += 1

func player_hit() -> void:
	if game_over or player.invulnerable:
		return
	chase_distance -= 5.5
	player.invulnerable = true
	player.modulate = Color(1.0, 0.35, 0.35)
	await get_tree().create_timer(0.55).timeout
	if is_instance_valid(player):
		player.modulate = Color.WHITE
		player.invulnerable = false
	if chase_distance <= 0.0:
		_end_run()

func _end_run() -> void:
	if game_over:
		return
	game_over = true
	player.alive = false
	game_over_panel.visible = true
	$HUD/GameOver/Panel/Result.text = "RUN ENDED\nScore  %06d\nRelics  %d\nDistance  %dm" % [score, coins, int(distance)]
	$HUD/GameOver/Panel/Hint.text = "Press R or tap RESTART"

func _unhandled_input(event: InputEvent) -> void:
	if game_over and event is InputEventKey and event.pressed and event.keycode == KEY_R:
		get_tree().reload_current_scene()
	elif game_over and event is InputEventScreenTouch and event.pressed:
		get_tree().reload_current_scene()

func _update_hud() -> void:
	score_label.text = "SCORE  %06d     RELICS  %02d     DIST  %dm" % [score, coins, int(distance)]
