/*
 * Copyright (c) 2014 Juniper Networks, Inc. All rights reserved.
 */

define([
    'contrail-graph-model',
    'core-basedir/js/views/ControlPanelView'
], function (ContrailGraphModel, ControlPanelView) {
    var GraphView = joint.dia.Paper.extend({
        constructor: function (viewConfig) {
            var self = this,
                graphConfig = viewConfig.graphModelConfig,
                tooltipConfig, clickEventsConfig, controlPanelConfig,
                graphControlPanelId = '#'+ ctwl.GRAPH_CONTROL_PANEL_ID;

            self.model = new ContrailGraphModel(graphConfig);
            self.viewConfig = viewConfig;

            joint.dia.Paper.apply(self, arguments);

            tooltipConfig = contrail.handleIfNull(viewConfig.tooltipConfig, []);
            clickEventsConfig = contrail.handleIfNull(viewConfig.clickEvents, {});
            controlPanelConfig = contrail.handleIfNull(viewConfig.controlPanel, false);

            self.model.beforeDataUpdate.subscribe(function() {
                $(self.el).find(".font-element").remove();
            });

            self.model.onAllRequestsComplete.subscribe(function() {
                if (self.model.error === true && contrail.checkIfFunction(viewConfig.failureCallback)) {
                    viewConfig.failureCallback(self.model);
                } else if (self.model.empty === true && contrail.checkIfFunction(viewConfig.emptyCallback)) {
                    viewConfig.emptyCallback(self.model)
                } else {
                    var graphSelectorElement = self.el;

                    if (controlPanelConfig) {
                        var viewAttributes = {
                                viewConfig: getControlPanelConfig(graphSelectorElement, self, graphConfig, controlPanelConfig)
                            },
                            controlPanelView = new ControlPanelView({
                                el: graphControlPanelId,
                                attributes: viewAttributes
                            });

                        controlPanelView.render();
                    }

                    initClickEvents(graphSelectorElement, clickEventsConfig, self);
                    initMouseEvents(graphSelectorElement, tooltipConfig, self);

                    if (contrail.checkIfFunction(viewConfig.successCallback)) {
                        viewConfig.successCallback(self);
                    }
                }
            });

            return self;
        },

        render: function () {
            this.model.fetchData();
        },

        refreshData: function () {
            this.model.refreshData();
        }
    });

    var initZoomEvents = function(graphSelectorElement, graphView, controlPanelSelector, graphConfig, controlPanelConfig) {
        var graphControlPanelElement = $(controlPanelSelector),
            panzoomTargetId = controlPanelConfig.default.zoom.selectorId,
            panZoomDefaultConfig = {
                increment: 0.2,
                minScale: 0.2,
                maxScale: 2,
                duration: 200,
                easing: "ease-out",
                contain: 'invert'
            },
            panzoomConfig = $.extend(true, panZoomDefaultConfig, controlPanelConfig.default.zoom.config);

        var focal = getZoomFocal(graphSelectorElement, panzoomTargetId),
            allowZoom = true;

        $(panzoomTargetId).panzoom("reset");
        $(panzoomTargetId).panzoom("resetPan");
        $(panzoomTargetId).panzoom("destroy");
        $(panzoomTargetId).panzoom(panzoomConfig);

        var performZoom = function(zoomOut) {
            //Handle clicks and queue extra clicks if performed with the duration for smooth animation
            if (allowZoom == true) {
                allowZoom = false;
                $(panzoomTargetId).panzoom("zoom", zoomOut, { focal: focal});
                setTimeout(function(){
                    allowZoom = true;
                }, panZoomDefaultConfig.duration);
            }
        };

        graphControlPanelElement.find(".zoom-in")
            .off('click')
            .on('click', function(e) {
                if (!$(this).hasClass('disabled')) {
                    e.preventDefault();
                    performZoom(false);
                }
            });

        graphControlPanelElement.find(".zoom-reset")
            .off('click')
            .on('click', function(e) {
                if (!$(this).hasClass('disabled')) {
                    e.preventDefault();
                    $(panzoomTargetId).panzoom("reset");
                }
            });

        graphControlPanelElement.find(".zoom-out")
            .off('click')
            .on('click', function(e) {
                if (!$(this).hasClass('disabled')) {
                    e.preventDefault();
                    performZoom(true);
                }
            });

        $(panzoomTargetId).on('panzoompan', function(e, panzoom, x, y) {
            $(panzoomTargetId).panzoom('resetDimensions');
            focal = getZoomFocal(graphSelectorElement, panzoomTargetId);
        });
    };

    function getZoomFocal(graphSelectorElement, panzoomTargetId) {
        if($(panzoomTargetId).length > 0) {
            var screenWidth = $(graphSelectorElement).parents('.col1').width(),
                screenHeight = $(graphSelectorElement).parents('.col1').height(),
                screenOffsetTop = $(panzoomTargetId).parent().offset().top,
                screenOffsetLeft = $(panzoomTargetId).parent().offset().left,
                focal = {
                    clientX: screenOffsetLeft + screenWidth / 2,
                    clientY: screenOffsetTop + screenHeight / 2
                };

            return focal;
        }
    }

    var getControlPanelConfig = function(graphSelectorElement, graphView, graphConfig, controlPanelConfig) {
        var customConfig = $.extend(true, {}, controlPanelConfig.custom);

        $.each(customConfig, function(configKey, configValue) {
            if (contrail.checkIfFunction(configValue.iconClass)) {
                configValue.iconClass = configValue.iconClass(graphView);
            }
        });

        return {
            default: {
                zoom: {
                    enabled: true,
                    events: function(controlPanelSelector) {
                        initZoomEvents(graphSelectorElement, graphView, controlPanelSelector, graphConfig, controlPanelConfig);
                    }
                }
            },
            custom: customConfig
        }
    };

    var initMouseEvents = function(graphSelectorElement, tooltipConfig, graphView) {
        var timer = null;
        $('.popover').remove();
        $.each(tooltipConfig, function (keyConfig, valueConfig) {
            valueConfig = $.extend(true, {}, cowc.DEFAULT_CONFIG_ELEMENT_TOOLTIP, valueConfig);
            $('g.' + keyConfig).popover('destroy');
            $('g.' + keyConfig).popover({
                trigger: 'manual',
                html: true,
                animation: false,
                placement: function (context, src) {
                    var srcOffset = $(src).offset(),
                        srcWidth = $(src)[0].getBoundingClientRect().width,
                        bodyWidth = $('body').width(),
                        bodyHeight = $('body').height(),
                        tooltipWidth = valueConfig.dimension.width;

                    $(context).addClass('popover-tooltip');
                    $(context).css({
                        'min-width': tooltipWidth + 'px',
                        'max-width': tooltipWidth + 'px'
                    });
                    $(context).addClass('popover-tooltip');

                    if (srcOffset.left > tooltipWidth) {
                        return 'left';
                    } else if (bodyWidth - srcOffset.left - srcWidth > tooltipWidth){
                        return 'right';
                    } else if (srcOffset.top > bodyHeight / 2){
                         return 'top';
                    } else {
                        return 'bottom';
                    }
                },
                title: function () {
                    return valueConfig.title($(this), graphView);
                },
                content: function () {
                    return valueConfig.content($(this), graphView);
                },
                container: $('body')
            })
            .off("mouseenter")
            .on("mouseenter", function () {
                var _this = this;
                    clearTimeout(timer);
                    timer = setTimeout(function(){
                        $('g').popover('hide');
                        $('.popover').remove();

                        $(_this).popover("show");

                        $(".popover").find('.btn')
                            .off('click')
                            .on('click', function() {
                                var actionKey = $(this).data('action'),
                                    actionsCallback = valueConfig.actionsCallback($(_this), graphView);

                                actionsCallback[actionKey].callback();
                                $(_this).popover('hide');
                            }
                        );

                        $(".popover").find('.popover-remove-icon')
                            .off('click')
                            .on('click', function() {
                                $(_this).popover('hide');
                                $(this).parents('.popover').remove();
                            }
                        );

                    }, contrail.handleIfNull(valueConfig.delay, cowc.TOOLTIP_DELAY))
            })
            .off("mouseleave")
            .on("mouseleave", function () {
                clearTimeout(timer);
            });
        });

        $(graphSelectorElement).find("text").on('mousedown touchstart', function (e) {
            e.stopImmediatePropagation();
            if($(this).closest('.no-drag-element').length == 0) {
                graphView.pointerdown(e);
            }
        });

        $(graphSelectorElement).find("image").on('mousedown touchstart', function (e) {
            e.stopImmediatePropagation();
            if($(this).closest('.no-drag-element').length == 0) {
                graphView.pointerdown(e);
            }
        });

        $(graphSelectorElement).find("polygon").on('mousedown touchstart', function (e) {
            e.stopImmediatePropagation();
            if($(this).closest('.no-drag-element').length == 0) {
                graphView.pointerdown(e);
            }
        });

        $(graphSelectorElement).find("path").on('mousedown touchstart', function (e) {
            e.stopImmediatePropagation();
            if($(this).closest('.no-drag-element').length == 0) {
                graphView.pointerdown(e);
            }
        });

        $(graphSelectorElement).find("rect").on('mousedown touchstart', function (e) {
            e.stopImmediatePropagation();
            if($(this).closest('.no-drag-element').length == 0) {
                graphView.pointerdown(e);
            }
        });

        $(graphSelectorElement).find(".font-element").on('mousedown touchstart', function (e) {
            e.stopImmediatePropagation();
            if($(this).closest('.no-drag-element').length == 0) {
                graphView.pointerdown(e);
            }
        });
    };

    function initClickEvents(graphSelectorElement, eventConfig, graphView) {
        var timer = null,
            topContainerElement = $('#' + ctwl.TOP_CONTENT_CONTAINER);

        var onTopContainerBankDblClickHandler = function(e) {
            if(!$(e.target).closest('g').length && !$(e.target).closest('.control-panel-items').length) {
                if(contrail.checkIfFunction(eventConfig['blank:pointerdblclick'])) {
                    eventConfig['blank:pointerdblclick']();
                }
            }
        };

        if(contrail.checkIfFunction(eventConfig['cell:pointerclick'])) {
            graphView
                .off('cell:pointerclick')
                .on('cell:pointerclick', function(cellView, evt, x, y) {
                    if (timer) {
                        clearTimeout(timer);
                    }

                    timer = setTimeout(function() {
                        eventConfig['cell:pointerclick'](cellView, evt, x, y);
                        clearTimeout(timer);
                    }, 500);
                });
        }

        if(contrail.checkIfFunction(eventConfig['cell:pointerdblclick'])) {
            graphView
                .off('cell:pointerdblclick')
                .on('cell:pointerdblclick', function(cellView, evt, x, y) {
                    clearTimeout(timer);
                    eventConfig['cell:pointerdblclick'](cellView, evt, x, y);
                });
        }

        $(document)
            .off('click', onDocumentClickHandler)
            .on('click', onDocumentClickHandler);

        $(window)
            .off('popstate')
            .on('popstate', function (event) {
                $('.popover').remove();
            });

        topContainerElement
            .off('dblclick', onTopContainerBankDblClickHandler)
            .on('dblclick', onTopContainerBankDblClickHandler);
    };

    var onDocumentClickHandler = function(e) {
        if(!$(e.target).closest('.popover').length) {
            $('g').popover('hide');
            $(this).parents('.popover').remove();
        }
    };

    return GraphView;
});