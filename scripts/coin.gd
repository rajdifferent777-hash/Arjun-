extends Area3D
class_name RunnerCoin

signal collected

var spin_speed := 5.0

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _process(delta: float) -> void:
	rotate_y(spin_speed * delta)

func _on_body_entered(body: Node3D) -> void:
	if body is RunnerPlayer:
		collected.emit()
		queue_free()
