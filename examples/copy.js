// "Copy" buttons for the example pages:
//   <button data-copy="id-of-element">    copies that element's text
//   <button data-copy-text="exact text">  copies the attribute value as is
document.querySelectorAll('[data-copy], [data-copy-text]').forEach(function (button) {
  button.addEventListener('click', function () {
    var text = button.dataset.copyText;
    if (text === undefined) {
      var source = document.getElementById(button.dataset.copy);
      text = source ? source.textContent.trim() : '';
    }
    var label = button.textContent;
    var show = function (text) {
      button.textContent = text;
      setTimeout(function () {
        button.textContent = label;
      }, 1500);
    };
    if (!text || !navigator.clipboard) return show('คัดลอกไม่สำเร็จ');
    navigator.clipboard.writeText(text).then(
      function () {
        show('คัดลอกแล้ว');
      },
      function () {
        show('คัดลอกไม่สำเร็จ');
      },
    );
  });
});
