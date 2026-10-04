extends Node3D
class_name TrackManager

const LANE_X := [-2.6, 0.0, 2.6]
const CHUNK_LENGTH := 32.0
const KEEP_AHEAD := 7
const KEEP_BEHIND := 2

var rng := RandomNumberGenerator.new()
var next_z := 0.0
var chunks: Array[Node3D] = []
var chunk_index := 0

func _ready() -> void:
	rng.seed = 824173
	for i in range(KEEP_AHEAD):
		_spawn_chunk()

func _process(_delta: float) -> void:
	while chunks.size() > 0 and chunks[0].global_position.z > 45.0:
		chunks[0].queue_free()
		chunks.pop_front()
	while next_z > -260.0:
		_spawn_chunk()

func _spawn_chunk() -> void:
	var root := Node3D.new()
	root.name = "Chunk_%03d" % chunk_index
	root.position.z = next_z
	add_child(root)
	_build_floor(root)
	_build_obstacles(root)
	_build_coins(root)
	chunks.append(root)
	next_z -= CHUNK_LENGTH
	chunk_index += 1

func _build_floor(root: Node3D) -> void:
	var floor := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(10.0, 0.5, CHUNK_LENGTH)
	floor.mesh = mesh
	floor.position.y = -1.0
	floor.material_override = _mat(Color(0.09, 0.12, 0.15))
	root.add_child(floor)
	var collider := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(10.0, 0.5, CHUNK_LENGTH)
	shape.shape = box
	shape.position.y = -1.0
	collider.add_child(shape)
	root.add_child(collider)

func _build_obstacles(root: Node3D) -> void:
	var gate_zs := [-12.0, -24.0]
	for local_z in gate_zs:
		var blocked := rng.randi_range(0, 2)
		var style := rng.randi_range(0, 2)
		for lane in range(3):
			if lane == blocked:
				continue
			if style == 0 and lane == (blocked + 1) % 3:
				continue
			_spawn_obstacle(root, lane, local_z)

func _spawn_obstacle(root: Node3D, lane: int, local_z: float) -> void:
	var obstacle := RunnerObstacle.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(2.0, 1.6, 1.6)
	shape.shape = box
	shape.position.y = 0.0
	obstacle.add_child(shape)
	var mesh := MeshInstance3D.new()
	var visual := BoxMesh.new()
	visual.size = Vector3(2.0, 1.6, 1.6)
	mesh.mesh = visual
	mesh.material_override = _mat(Color(0.55, 0.12, 0.14))
	obstacle.add_child(mesh)
	obstacle.position = Vector3(LANE_X[lane], 0.0, local_z)
	obstacle.player_hit.connect(_on_obstacle_hit)
	root.add_child(obstacle)

func _build_coins(root: Node3D) -> void:
	var safe_lane := rng.randi_range(0, 2)
	for i in range(6):
		var coin := RunnerCoin.new()
		var shape := CollisionShape3D.new()
		var sphere := SphereShape3D.new()
		sphere.radius = 0.65
		shape.shape = sphere
		coin.add_child(shape)
		var mesh := MeshInstance3D.new()
		var visual := CylinderMesh.new()
		visual.top_radius = 0.45
		visual.bottom_radius = 0.45
		visual.height = 0.12
		mesh.mesh = visual
		mesh.material_override = _mat(Color(0.95, 0.72, 0.16))
		coin.add_child(mesh)
		coin.position = Vector3(LANE_X[safe_lane], 0.15, -5.0 - i * 1.8)
		coin.collected.connect(_on_coin_collected)
		root.add_child(coin)

func _mat(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.72
	return material

func _on_coin_collected() -> void:
	var game := get_parent()
	if game.has_method("add_coin"):
		game.add_coin()

func _on_obstacle_hit() -> void:
	var game := get_parent()
	if game.has_method("player_hit"):
		game.player_hit()
