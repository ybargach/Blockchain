from django.test import TestCase
from django.contrib.auth.models import User
from .models import GameScore
from .game_logic import Snake, Direction

class SnakeGameTests(TestCase):
    def setUp(self):
        self.snake = Snake()

    def test_snake_movement(self):
        initial_position = self.snake.positions[0]
        self.snake.move(Direction.RIGHT)
        new_position = self.snake.positions[0]
        self.assertEqual(new_position[0], initial_position[0] + 1)
        self.assertEqual(new_position[1], initial_position[1])

    def test_collision_detection(self):
        # Force snake into wall
        self.snake.positions = [(0, 0)]
        self.snake.move(Direction.LEFT)
        self.assertTrue(self.snake.check_collision())
