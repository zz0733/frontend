with (Hasher.Controller('Modal')) {
  create_action('show', function() {
    if ($('#modal-dialog').length > 0) call_action('hide');
    document.body.appendChild(helper('modal', helper.apply(this, Array.prototype.slice.call(arguments))));

    // Fix placeholder does not work in IE
    Placeholder.fix_ie();
  });
  
  create_action('hide', function() {
    $('#modal-dialog').remove();
  });
}

with (Hasher.View('Modal')) {
  create_helper('modal', function() {
    var ie_browser = (/MSIE (\d+\.\d+);/.test(navigator.userAgent));
    return div({ 'id': 'modal-dialog', 'class': (ie_browser? 'ie-modal-dialog ' : '') + 'modal-dialog', events: { click: function(e) { if (e.target && e.target.id == 'modal-dialog') action('hide').call(); } } },
      div({ id: 'modal-content' },
        a({ href: action('hide'), 'class': 'close-button' }, 'X'),
        Array.prototype.slice.call(arguments)
      )
    );
  });
}