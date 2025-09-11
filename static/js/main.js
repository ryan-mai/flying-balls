// import * as THREE from 'three';
document.addEventListener('DOMContentLoaded', () => {
    let problem = null;

    async function loadProblem() {
        try {
            const res = await fetch('/api/problem');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            problem = await res.json();
            document.getElementById('desc').innerText = problem.question || 'No question';
            document.getElementById('answer').value = '';
            document.getElementById('message').innerText = '';
        } catch (err) {
            document.getElementById('desc').innerText = 'Failed to load problem';
            console.error(err);
        }
    }
    async function checkAnswer() {
        const input = document.getElementById('answer');
        const value = input.value;
        const qtype = document.getElementById('qtype').value;
        if (value === '') {
            document.getElementById('message').innerText = 'Enter an answer';
            return;
        }
        try {
            const res = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: problem.id, type: qtype, value: value }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server error');
            document.getElementById('message').innerText = data.is_correct
                ? 'Correct'
                : `Incorrect - Solution: ${Number(data.correct).toFixed(2)}`;
        } catch (err) {
            console.error(err);
            document.getElementById('message').innerText = 'Check failed';
     
        }
    }
    document.getElementById('submit').addEventListener('click', checkAnswer);
    loadProblem();
});