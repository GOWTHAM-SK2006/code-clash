(function () {
    renderNav('battle');
    if (!requireAuth()) return;

    const mode2v2Btn = document.getElementById('mode2v2Btn');
    if (mode2v2Btn) {
        mode2v2Btn.addEventListener('click', function () {
            alert('2 vs 2 mode is coming soon. Please use 1 vs 1 for now.');
        });
    }
})();
