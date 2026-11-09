// "Copy" buttons for the example pages: <button data-copy="id-of-element-to-copy">
document.querySelectorAll('[data-copy]').forEach(function (button) {
  button.addEventListener('click', function () {
    var source = document.getElementById(button.dataset.copy);
    var label = button.textContent;
    var show = function (text) {
      button.textContent = text;
      setTimeout(function () {
        button.textContent = label;
      }, 1500);
    };
    if (!source || !navigator.clipboard) return show('คัดลอกไม่สำเร็จ');
    navigator.clipboard.writeText(source.textContent.trim()).then(
      function () {
        show('คัดลอกแล้ว');
      },
      function () {
        show('คัดลอกไม่สำเร็จ');
      },
    );
  });
});
