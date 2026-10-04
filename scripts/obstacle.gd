extends Area3D
class_name RunnerObstacle

signal player_hit

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if body is RunnerPlayer:
		player_hit.emit()
		body.hit()
