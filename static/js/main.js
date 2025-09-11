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

    loadProblem();
});