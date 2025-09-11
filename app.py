from flask import Flask, render_template, jsonify, request, send_from_directory
import math
import random


app = Flask(__name__, static_folder='static')

G = 9.8
PROBLEMS = {}
def example_problem():
    v0 = random.randint(1, 67)
    t = random.randint(1,67)
    problem = {
        'id': random.randint(1, 100000),
        'question': f'A rock is thrown with an initial velocity of {v0}m/s upwards. Determine the displacement after {t}s. Round to the nearest whole.',
        'r0': [0.0, 0.0, 0.0], # Origin
        'v0': [0.0, v0, 0.0],
        'gravity': [0.0, -G, 0.0],
        'time': t,
        'units': {'distance':'m', 'time':'s', 'velocity': 'm/s'},
    }
    d = round(problem['r0'][1] + problem['v0'][1] * problem['time'] + 0.5 * problem['gravity'][1] * problem['time']**2)
    problem['answers'] = [d]
    PROBLEMS[problem['id']] = problem
    return problem

@app.route('/api/problem')
def get_problem():
    problem = example_problem()
    debug = request.args.get('debug', 'false').lower() == 'true'
    if not debug:
        problem.pop('answers', None)
    return jsonify(problem)

@app.route('/api/check', methods=['POST'])
def check_problem():
    data = request.get_json()
    if data is None:
        return jsonify({ 'ok': False, 'error': 'Missing JSON' }), 400
    problem = example_problem()
    pid = data.get('id')
    if pid is None:
        return jsonify({ 'ok': False, 'error': 'Missing JSON' }), 400
    try:
        pid = int(pid)
    except (TypeError, TypeError):
        return jsonify({ 'ok': False, 'error': 'Missing JSON' }), 400
    problem = PROBLEMS.get(pid)
    if problem is None:
        return jsonify({ 'ok': False, 'error': 'Missing JSON' }), 400
    t = problem['time']
    g_vec = problem['gravity']
    g = g_vec[1]
    r0 = problem['r0']
    v0 = problem['v0']
    answer = { 'displacement': r0[1] + v0[1]*t + 0.5 * g * (t**2.0)}
    qtype = data.get('type')
    try:
        user_res = float(data.get('value'))
    except (TypeError, ValueError):
        return jsonify({ 'ok': False, 'error': 'Invalid number' }), 400
    if qtype not in answer:
        return jsonify({ 'ok': False, 'error': 'Invalid question' }), 400
    correct = answer[qtype]
    tolerance = float(data.get('tolerance', 0.5))
    is_correct = abs(user_res - correct) <= tolerance
    res = {
        'ok': True,
        'is_correct': is_correct,
        'correct': correct,
        'problem': {
            'r0': r0,
            'v0': v0,
            'gravity': g,
            'time': t
        }
    }
    return jsonify(res)

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    app.run(debug=True)