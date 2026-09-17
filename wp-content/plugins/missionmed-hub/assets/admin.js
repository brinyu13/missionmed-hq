/**
 * MissionMed Hub — Admin JS.
 *
 * Quick-edit inline status change for mmed_task list table.
 */
(function($){
    'use strict';

    if ( typeof mmedAdmin === 'undefined' ) {
        return;
    }

    /**
     * Quick status change: clicking a status badge opens a dropdown.
     */
    $(document).on('click', '.mmed-status-badge[data-task-id]', function(e){
        e.preventDefault();
        var $badge = $(this);
        var taskId = $badge.data('task-id');

        // If dropdown already open, remove it.
        if ( $badge.next('.mmed-status-dropdown').length ) {
            $badge.next('.mmed-status-dropdown').remove();
            return;
        }

        // Remove any other open dropdowns.
        $('.mmed-status-dropdown').remove();

        var statuses = {
            'not_started':     'Not Started',
            'in_progress':     'In Progress',
            'pending_review':  'Under Review',
            'approved':        'Approved',
            'revision_needed': 'Revision Needed'
        };

        var $dropdown = $('<div class="mmed-status-dropdown"></div>');
        $.each(statuses, function(val, label){
            $dropdown.append(
                $('<a href="#" class="mmed-status-option"></a>')
                    .attr('data-status', val)
                    .text(label)
            );
        });

        $badge.after($dropdown);
    });

    /**
     * Handle status selection from dropdown.
     */
    $(document).on('click', '.mmed-status-option', function(e){
        e.preventDefault();
        var $option   = $(this);
        var $dropdown = $option.closest('.mmed-status-dropdown');
        var $badge    = $dropdown.prev('.mmed-status-badge');
        var taskId    = $badge.data('task-id');
        var newStatus = $option.data('status');

        $dropdown.remove();
        $badge.text('Saving…').css('opacity', 0.6);

        $.post(mmedAdmin.ajax_url, {
            action:      'mmed_quick_status',
            _mmed_nonce: mmedAdmin.nonce,
            task_id:     taskId,
            status:      newStatus
        }, function(response){
            if ( response.success ) {
                $badge
                    .text(response.data.label)
                    .css({
                        'opacity': 1,
                        'background': response.data.color
                    })
                    .attr('data-status', newStatus);
            } else {
                $badge.text('Error').css('opacity', 1);
                alert(response.data.message || 'Failed to update status.');
            }
        }).fail(function(){
            $badge.text('Error').css('opacity', 1);
        });
    });

    /**
     * Close dropdowns when clicking elsewhere.
     */
    $(document).on('click', function(e){
        if ( !$(e.target).closest('.mmed-status-badge, .mmed-status-dropdown').length ) {
            $('.mmed-status-dropdown').remove();
        }
    });

})(jQuery);
