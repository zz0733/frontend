// - show full reg details below
// - add expiry (+ X year)

with (Hasher('Register','Application')) {
  define('full_form', function(domain) {
    var target_div = div();
    
    render({ into: target_div },
      form_with_loader({ 'class': 'fancy', action: process_full_form, loading_message: "Registering " + domain + "..." },
        div({ id: 'errors' }),

        // render an info message into this div if credits were just added to the account in order
        // to proceed with the registration.
        Billing.render_num_credits_added(),

        input({ type: 'hidden', name: 'name', value: domain }),
        input({ type: 'hidden', name: 'auto_renew', value: 'true'}),
        input({ type: 'hidden', name: 'privacy', value: 'true'}),
        input({ type: 'hidden', name: 'name_servers', value: 'ns1.badger.com,ns2.badger.com'}),

        fieldset(
          label({ 'for': 'years' }, 'Duration:'),
          select({ name: 'years', id: 'years' },
            option({ value: 1 }, '1 Year'),
            option({ value: 2 }, '2 Years'),
            option({ value: 3 }, '3 Years'),
            option({ value: 4 }, '4 Years'),
            option({ value: 5 }, '5 Years'),
            option({ value: 10 }, '10 Years')
          ),
          span({ 'class': 'big-text' }, ' @ 1 credit per year')
        ),

        fieldset(
          label({ 'for': 'years' }, 'Expiration:'),
          div({ 'class': 'big-text', id: 'expiration-date' })
        ),

        // fieldset(
        //   label({ 'for': 'first_name-input' }, 'Also Register:'),
        //   div(similar_domain_list(domain))
        // ),

        Contact.selector_with_all_form_fields({ name: 'registrant_contact_id' }),

        fieldset({ 'class': 'no-label' },
          submit({ id: 'register-button', value: 'Register ' + Domains.truncate_domain_name(domain) + ' for 1 credit' })
        )
      )
    );
    
    return target_div;
    
    // // show a message after person buys credits
    // if (form_data && form_data.credits_added) {
    //   BadgerCache.getAccountInfo(function(response) {
    //     $("div#errors").html(
    //       div({ 'class': "info-message" }, "Success! You now have " + response.data.domain_credits + " domain " + (response.data.domain_credits > 1 ? "credits" : "credit") + ".")
    //     );
    //   });
    // }
    // 
    // $('select[name=years]').change(function(e) {
    //   var years = parseInt($('#years').val());
    //   var num_domains = 1 + $('.extensions:checked').length;
    //   var credits = num_domains * years;
    //   
    //   $('#register-button').val('Register ' + (num_domains > 1 ? (num_domains + ' domains') : domain) + ' for ' + credits + (credits == 1 ? ' credit' : ' credits'))
    // })
    // 
    // if (form_data) {
    //   $("select[name=years] option[value=" + form_data.years + "]").attr('selected','selected');
    //   $("select[name=registrant_contact_id] option[value=" + form_data.registrant_contact_id + "]").attr('selected','selected');
    //   
    //   $("select[name=years]").trigger('change');
    // }

  });
  
  define('similar_domain_list', function(domain) {
    var similar_domain_div = div({ id: 'similar_domain_span' },  spinner('Loading...'));

    Badger.domainSearch(domain.split('.')[0], true, function(response) {
      var similar_domains = [];//'something.com', 'something2.com'];
      for (var i=0; i < response.data.domains.length; i++) {
        if (response.data.domains[i][1] && (response.data.domains[i][0] != domain)) {
          similar_domains.push(response.data.domains[i][0]);
        }
      }

      render({ into: similar_domain_div}, 
        similar_domains.map(function(domain) {
          var sanitized_id = "similar_" + domain.replace(/[^a-z0-9]/,'_');
          return div({ style: 'line-height: 22px;' },
            checkbox({ name: "additional_domains[]", value: domain, id: sanitized_id }),
            label({ 'class': 'normal right-margin', 'for': sanitized_id }, domain)
          );
        })
      );
    });

    return similar_domain_div;
  });






  define('show', function(domain, available_extensions) {
    if (!available_extensions) available_extensions = [];
    if (!Badger.getAccessToken()) {
      Signup.require_user_modal(curry(Register.show, domain, available_extensions));
      return;
    }

    BadgerCache.getContacts(function(results) {
      // ensure they have at least one whois contact
      if (results.data.length == 0) {
        Whois.edit_whois_modal(null, curry(Register.show, domain, available_extensions));
      } else {
        buy_domain_modal(domain, available_extensions);
      }
    });
  });

  define('process_full_form', function(form_data, callback) {
    $('#errors').empty();
    
    Contact.create_contact_if_necessary_form_data({
      field_name: 'registrant_contact_id',
      form_data: form_data,
      message_area: $('#errors').first(),
      callback: curry(Badger.registerDomain, form_data, function(response) {
        if (response.meta.status == 'created') {
          update_credits(true);
          BadgerCache.flush('domains');
          BadgerCache.getDomains(update_my_domains_count);
          
          // cleanup session variables
          Badger.Session.remove('credits_added', 'years');
          
          set_route('#domains/' + form_data.name);
          
          Share.show_share_registration_modal(form_data.name);
        } else {
          // TODO: wire in credit screen if not enough
          $('#errors').html(error_message(response))
          
          if (response.data && response.data.extra && response.data.extra) {
            
            Badger.Session.write({
              years: form_data.years,
              necessary_credits: response.data.extra.necessary_credits,
              redirect_url: get_route()
            });
            
            set_route("#account/billing/credits");
          }
        }
        
        hide_form_submit_loader();
        
        // if (response.meta.status == 'created') {
        //   console.log("")
        //   start_modal_spin('Configuring ' + domain + '...');
        //   update_credits(true);
        //       
        //   load_domain(response.data.name, function(domain_object) {
        //     // this now happens server side
        //     // DomainApps.install_app_on_domain(Hasher.domain_apps["badger_web_forward"], domain_object);
        //     BadgerCache.flush('domains');
        //     BadgerCache.getDomains(function() { 
        //       update_my_domains_count(); 
        //       
        //       set_route('#domains/' + domain);
        //       // hide_modal();
        //        Share.show_share_registration_modal(domain);
        //     });
        //   });
        // } else {
        //   // if the registration failed, we actually need to re-render the registration modal because if the user
        //   // had to buy credits in the previous step, the underlying modal is the purcahse modal and not the
        //   // registration modal.
        //   buy_domain_modal(domain, available_extensions);
        //   $('#errors').empty().append(error_message(response));
        // }
      })
    });
    
    
    // var checked_extensions = $.grep(available_extensions, function(ext) {
    //   return form_data["extension_" + ext[0].split('.')[1]] != null;
    // })
    // checked_extensions = [domain].concat(checked_extensions.map(function(ext) { return ext[0]; }));
    // 
    // $('#errors').empty();
    // start_modal_spin('Checking available credits...');
    // 
    // BadgerCache.getAccountInfo(function(results) {
    //   var needed_credits = checked_extensions.length * form_data.years;
    //   var current_credits = results.data.domain_credits;
    //   
    //   if (current_credits >= needed_credits) {
    //     if (checked_extensions.length > 1) {
    //       form_data.new_domains = checked_extensions;
    //       Transfer.register_or_transfer_all_domains(form_data);
    //     } else {
    //       register_domain(domain, available_extensions, form_data);
    //     }
    //   } else {
    //     // Billing.purchase_modal(curry(buy_domain, domain, available_extensions, form_data), needed_credits - current_credits);
    //     Billing.purchase_modal(curry(buy_domain_modal, domain, available_extensions, $.extend(form_data, { credits_added: true })), needed_credits - current_credits); // after successfully buying credits, go back to the initial register modal --- CAB
    //   }
    // });
  });

	define('renew_domain', function(form_data) {
		$('#errors').empty();
    start_modal_spin('Checking available credits...');

    BadgerCache.getAccountInfo(function(results) {
      var needed_credits = form_data.years
      var current_credits = results.data.domain_credits;
      
      if (current_credits >= needed_credits) {
				start_modal_spin('Renewing domain...');
				Badger.renewDomain(form_data.domain, form_data.years, function(response) {
					if (response.meta.status == "ok") {
						hide_modal();
						set_route("#domains/" + form_data.domain + "/registration");
						update_credits(true);
					} else {
						stop_modal_spin();
						$("#errors").append(div({ 'class': "error-message" }, response.data.message));
					}
				});
      } else {
        // Billing.purchase_modal(curry(renew_domain, form_data), needed_credits - current_credits);
        Billing.purchase_modal(curry(renew_domain_modal, form_data.domain, $.extend(form_data, { credits_added: true })), needed_credits - current_credits); // after successfully buying credits, go back to the initial renewal modal --- CAB
      }
    });
	});
	
  // NOTE: this function has a few race conditions...
  //  - "install_app_on_domain" isn't chained so the getDomains() could finish first
  //    and redirect you to the domain page before the dns entries are installed.
  // define('register_domain', function(domain, available_extensions, form_data) {
  //   start_modal_spin('Registering ' + domain + '...');
  //   Badger.registerDomain(form_data, function(response) {
  //     if (response.meta.status == 'created') {
  //       start_modal_spin('Configuring ' + domain + '...');
  //       update_credits(true);
  // 
  //       load_domain(response.data.name, function(domain_object) {
  //         // this now happens server side
  //         // DomainApps.install_app_on_domain(Hasher.domain_apps["badger_web_forward"], domain_object);
  //         BadgerCache.flush('domains');
  //         BadgerCache.getDomains(function() { 
  //           update_my_domains_count(); 
  //           
  //           set_route('#domains/' + domain);
  //           // hide_modal();
  //            Share.show_share_registration_modal(domain);
  //         });
  //       });
  //     } else {
  //       // if the registration failed, we actually need to re-render the registration modal because if the user
  //       // had to buy credits in the previous step, the underlying modal is the purcahse modal and not the
  //       // registration modal.
  //       buy_domain_modal(domain, available_extensions);
  //       $('#errors').empty().append(error_message(response));
  //     }
  //   })
  // });

	define('renew_domain_modal', function(domain, form_data) {
		show_modal(
      h1({ 'class': 'long-domain-name'}, 'Extend Registration'),
      div({ id: 'errors' }),
			p("The domain, " + domain +", will automatically renew on its expiration date.  If you'd prefer, you can extend this registration immediately by using the form below."),
			form({ action: curry(renew_domain), style: "margin-bottom: -15px" },
				div({ 'class': "info-message", style: "width: 220px", align: "center" },
					p({ style: "font-weight: bold; font-size: 16px; font-style: italic; margin: 0 auto 10px auto" }, "1 year = 1 domain credit"),
					div({ style: "font-size: 16px" }, "Years:", select({ style: "font-size: 16px; margin-left: 15px", name: "years" },
						option({ value: 1 }, "1"),
						option({ value: 2 }, "2"),
						option({ value: 3 }, "3"),
						option({ value: 4 }, "4"),
						option({ value: 5 }, "5"),
            option({ value: 6 }, "6"),
            option({ value: 7 }, "7"),
            option({ value: 8 }, "8"),
            option({ value: 9 }, "9"),
						option({ value: 10 }, "10")
					))
				),
				input({ type: "hidden", value: domain, name: "domain" }),
				button({ id: "renew-button", 'class': "myButton", style: "float: right; margin-top: -45px"}, "Renew domain")
			)
		);
		
		// show a message after person buys credits
    if (form_data && form_data.credits_added) {
      BadgerCache.getAccountInfo(function(response) {
        $("div#errors").html(
          div({ 'class': "info-message" }, "Success! You now have " + response.data.domain_credits + " domain " + (response.data.domain_credits > 1 ? "credits" : "credit") + ".")
        );
      });
    }
		
		// update the button according to, then call the trigger the change event to initially update the button 
		$("select[name=years]").change(function(e) {
			$("#renew-button").html("Renew for " + e.target.value + " years (" + e.target.value + " credits)");
		});
		
    // $("select[name=years]").change();
    $("select[name=years]").trigger('change');
		
		if (form_data) {
      $("select[name=years] option[value=" + form_data.years + "]").attr('selected','selected');
      $("select[name=years]").trigger('change');
    }
	});
	

  // define('open_link', function(url) {
  //   hide_modal();
  //   set_route(url);
  // });
  // define('successful_register_confirmation', function(domain) {
  //   return [
  //     h1("Congratulations!"),
  //     p("You've just registered ", strong(domain), ". Here are some things you can do:"),
  //     ul(
  //       li(a({ href: curry(Register.open_link, "#domains/" + domain) }, "View domain details")),
  //       li(a({ href: curry(Register.open_link, "#domains/" + domain + "/dns") }, "Modify DNS Settings")),
  //       li(a({ href: curry(Register.open_link, "#domains/" + domain + "/whois") }, "Modify WHOIS Settings")),
  //       li(a({ href: curry(Register.open_link, "#") }, "View all Domains"))
  //     )
  //   ];
  // });
}
