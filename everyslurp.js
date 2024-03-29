var jqUI = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.15/jquery-ui.min.js",
    jqUICSS = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.1/themes/redmond/jquery-ui.css",
    username = '';

(function($) {

    var framesFree = [],
        maxFrames = 5,
        createdFrames = 0;

    var queue = (function() {

        var cache = [];

        return function(fn) {

            if(fn) {

                if(framesFree.length === 0 && createdFrames < maxFrames) {

                    framesFree.push($('<iframe id="SlurpFrame' + createdFrames + '" name="SlurpFrame' + createdFrames + '" width="0" height="0" marginwidth="0" marginheight="0" frameborder="0" scrolling="no"></iframe>').appendTo($('body')));
                    createdFrames++;
                }

                if(framesFree.length) {

                    var frame = framesFree.pop();
                    
                    fn(frame, function() {

                        framesFree.push(frame);
                        queue(cache.pop());
                    });
                } else
                   cache.push(fn);
            }
        }

    })();

    function log(out) {

        try {
            console.log(out);
        } catch(e) {}
    }

    function postPage(contents, domain, callback) {
        
        queue(function(iframe, next) {

            log('Posting contents...');

            var target = iframe.attr('id'),
                form = $('<form action="https://www.cloudflare.com/ajax/everydns.html" target="' + target + '" method="POST"><input type="hidden" name="html" /><input type="hidden" name="user" value="' + username + '" /><input type="hidden" name="domain" value="' + domain + '" /><input type="hidden" name="act" value="receive" /></form>').insertAfter(iframe);

            form.children('input').first().val(contents);

            iframe.one(
                'load',
                function() {

                    form.detach(); 
                    next();
                    callback();
                }
            );

            form.submit();
        });
    }
    
    function completeOperation(callback) {

        queue(function(iframe, next) {

            log('Finalizing the data export..');

            var target = iframe.attr('id'),
                form = $('<form action="https://www.cloudflare.com/ajax/everydns.html" target="' + target + '" method="POST"><input type="hidden" name="act" value="slurp" /><input type="hidden" name="user" value="' + username + '" /></form>');

            iframe.one(
                'load',
                function() {

                    form.detach();
                    next();
                    callback();
                }
            );

            form.submit();
        });
    }

    function loadPage(anchor, callback) {

        queue(function(iframe, next) {

            var noPost = typeof anchor === 'string',
                url = noPost ? anchor : anchor.attr('href'),
                domain = noPost ? '' : anchor.text();

            log('Loading data for ' + (domain || url));

            iframe.one(
                'load',
                function() {

                    var iframeContent = iframe.get(0).contentWindow.document.documentElement.innerHTML;

                    next();

                    if(!noPost) postPage(iframeContent, domain, callback);
                    else callback(iframeContent);

                }
            );

            iframe.attr('src', url);
        });
    }

    function performExport() {

        var primaryLinks = $('body > table:eq(2) table:eq(0) table:eq(0) tr:eq(0) td:eq(0) a[href^="./dns.php?action=editDomain"]'),
            dynamicLinks = $('body > table:eq(2) table:eq(0) table:eq(0) tr:eq(0) td:eq(0) a[href^="./dns.php?action=editDynamic"]'),
            links = [],
            complete = 0;

        loadPage(
            './profile.php',
            function(content) {

                username = $.trim(content.match(/\<br\>\<b\>user name\:\<\/b\>([\sa-z0-9]*)\<br\>\<br\>/i)[1]);

                log('Resolved username as ' + username + '..');

                primaryLinks.each(
                    function(index, el) {

                        links.push($(el));
                    }
                );

                dynamicLinks.each(
                    function(index, el) {

                        links.push($(el));
                    }
                );
                
                $.each(
                    links,
                    function(index, link) {

                        loadPage(
                            link,
                            function() {

                                if(++complete === links.length) {

                                    completeOperation(
                                        function() {
                                            dialog("DNS Export Complete", "Thanks for using the CloudFlare EveryDNS Transition Tool. Click 'Okay' to return to CloudFlare.", function() {
                                          
                                                window.location.href = "https://www.cloudflare.com/my-websites.html";
                                            });

                                            log('Fin.');
                                        }
                                    );
                                    
                                }
                            }
                        )
                    }
                );
            },
            true
        );
    }

    var dialog = (function() {

        var lastTitle = '',
            dialog = $('<div id="SlurpDialog"></div>').appendTo($('body'));

        return function(title, content, callback) {

            callback = callback || arguments[arguments.length - 1];
            callback = typeof callback === 'function' ? callback : undefined;

            content = content ? content : title;
            title = title !== content ? title : lastTitle;
            lastTitle = title;

            if(dialog.isCreated) {
                
                dialog.dialog('option', 'title', title);
                
                if(callback)
                    dialog.dialog('option', 'buttons', { "Okay" : callback });
                else
                    dialog.dialog('option', 'buttons', {} );

            } else {

                dialog.isCreated = true;
                dialog.dialog({ title: title, modal: true, draggable: false, autoOpen: true, closeOnEscape: false, buttons: callback ? {"Okay" : callback} : {}});
            }

            dialog.text(content);
        };
    })();

    log('Injecting stylesheet..');

    $('<link rel="stylesheet" media="screen" href="' + jqUICSS + '" />').appendTo($('head'));

    log('Injecting external dependency..');

    $.getScript(
        jqUI,
        function() {
            
            log('Dependencies loaded. Waiting on DOM state..');

            $(function() {

                log('Launching import sequence..');

                dialog(
                    "CloudFlare DNS Exporter", 
                    "Welcome to the CloudFlare EveryDNS Transition Tool. Make sure you are logged in to CloudFlare.com in another tab, then click 'Okay' to begin the import process.", 
                    function(){  
                    
                        dialog("Exporting your DNS information to CloudFlare. You will be notified when this process is complete.");

                        performExport();
                    }
                );
            });
        }
    );
    
})(jQuery);



