// THIS IS AN ATTEMPT TO CLEAN UP THIS MODEL

nv.models.stackedArea = function() {
  //Default Settings
  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 960,
      height = 500,
      color = d3.scale.category20().range(), // array of colors to be used in order
      id = Math.floor(Math.random() * 100000), //Create semi-unique ID incase user doesn't selet one
      getX = function(d) { return d.x }, // accessor to get the x value from a data point
      getY = function(d) { return d.y }, // accessor to get the y value from a data point
      style = 'stack',
      offset = 'zero',
      order = 'default',
      clipEdge = false; // if true, masks lines within x and y scale

/************************************
 * offset:
 *   'wiggle' (stream)
 *   'zero' (stacked)
 *   'expand' (normalize to 100%)
 *   'silhouette' (simple centered)
 *
 * order:
 *   'inside-out' (stream)
 *   'default' (input order)
 ************************************/

  var stacked = d3.layout.stack()
                 //.offset('zero')
                 .values(function(d) { return d.values })  //TODO: make values customizeable in EVERY model in this fashion
                 .x(getX)
                 .y(function(d) { return d.stackedY })
                 .out(function(d, y0, y) {
                    d.display = {
                      y: y,
                     y0: y0
                    };
                  }),
      scatter = nv.models.scatter()
                  .size(2.2) // default size
                  .sizeDomain([2.5]), //set to speed up calculation, needs to be unset if there is a cstom size accessor
      x = scatter.xScale(),
      y = scatter.yScale(),
      dispatch =  d3.dispatch('tooltipShow', 'tooltipHide', 'areaClick', 'areaMouseover', 'areaMouseout');

  function chart(selection) {
    selection.each(function(data) {
        var availableWidth = width - margin.left - margin.right,
            availableHeight = height - margin.top - margin.bottom;


        // Injecting point index into each point because d3.layout.stack().out does not give index
        // ***Also storing getY(d,i) as yStacked so that it can be set to 0 if series is disabled
        // TODO: see if theres a way to deal with disabled series more consistent with the other models
        data = data.map(function(aseries, i) {
                 aseries.values = aseries.values.map(function(d, j) {
                   d.index = j;
                   d.stackedY = aseries.disabled ? 0 : getY(d,j);
                   return d;
                 })
                 return aseries;
               });

/*
        //TODO: Figure out why stream mode is broken with this
        data = stacked
                .order(order)
                .offset(offset)
                (data);
*/

        data = d3.layout.stack()
                 .order(order)
                 .offset(offset)
                 .values(function(d) { return d.values })  //TODO: make values customizeable in EVERY model in this fashion
                 .x(getX)
                 .y(function(d) { return d.stackedY })
                 .out(function(d, y0, y) {
                    d.display = {
                      y: y,
                     y0: y0
                    };
                  })
                (data);


        var wrap = d3.select(this).selectAll('g.wrap.stackedarea').data([data]);
        var wrapEnter = wrap.enter().append('g').attr('class', 'wrap nvd3 stackedarea');
        var defsEnter = wrapEnter.append('defs');
        var gEnter = wrapEnter.append('g');
        var g = wrap.select('g');

        gEnter.append('g').attr('class', 'areaWrap');


        scatter
          .width(availableWidth)
          .height(availableHeight)
          //.x(function(d) { return d.display.x })
          .x(getX)
          .y(function(d) { return d.display.y + d.display.y0 }) // TODO: allow for getY to be other than d.y
          .forceY([0])
          .color(data.map(function(d,i) {
            return d.color || color[i % color.length];
          }).filter(function(d,i) { return !data[i].disabled }));


        gEnter.append('g').attr('class', 'scatterWrap');
        var scatterWrap = g.select('.scatterWrap')
            .datum(data.filter(function(d) { return !d.disabled }))

        d3.transition(scatterWrap).call(scatter);




        wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');


        defsEnter.append('clipPath')
            .attr('id', 'edge-clip-' + id)
          .append('rect');

        wrap.select('#edge-clip-' + id + ' rect')
            .attr('width', availableWidth)
            .attr('height', availableHeight);

        g   .attr('clip-path', clipEdge ? 'url(#edge-clip-' + id + ')' : '');




        var area = d3.svg.area()
            .x(function(d,i)  { return x(getX(d,i)) })
            //.x(function(d)  { return x(d.display.x) })
            .y0(function(d) { return y(d.display.y0) })
            .y1(function(d) { return y(d.display.y + d.display.y0) });

        var zeroArea = d3.svg.area()
            .x(function(d,i)  { return x(getX(d,i)) })
            //.x(function(d)  { return x(d.display.x) })
            .y0(function(d) { return y(d.display.y0) })
            .y1(function(d) { return y(d.display.y0) });


        var path = g.select('.areaWrap').selectAll('path.area')
            .data(function(d) { return d });
            //.data(function(d) { return d }, function(d) { return d.key });
        path.enter().append('path').attr('class', function(d,i) { return 'area area-' + i })
            .on('mouseover', function(d,i) {
              d3.select(this).classed('hover', true);
              dispatch.areaMouseover({
                point: d,
                series: d.key,
                pos: [d3.event.pageX, d3.event.pageY],
                seriesIndex: i
              });
            })
            .on('mouseout', function(d,i) {
              d3.select(this).classed('hover', false);
              dispatch.areaMouseout({
                point: d,
                series: d.key,
                pos: [d3.event.pageX, d3.event.pageY],
                seriesIndex: i
              });
            })
            .on('click', function(d,i) {
              d3.select(this).classed('hover', false);
              dispatch.areaClick({
                point: d,
                series: d.key,
                pos: [d3.event.pageX, d3.event.pageY],
                seriesIndex: i
              });
            })
        d3.transition(path.exit())
            .attr('d', function(d,i) { return zeroArea(d.values,i) }) // TODO: fix this so transition is still fluid
            .remove();
        path
            .style('fill', function(d,i){ return d.color || color[i % color.length] })
            .style('stroke', function(d,i){ return d.color || color[i % color.length] });
        d3.transition(path)
            .attr('d', function(d,i) { return area(d.values,i) })


        scatter.dispatch.on('elementClick.area', function(e) {
          dispatch.areaClick(e);
        })
        scatter.dispatch.on('elementMouseover.area', function(e) {
          g.select('.area-' + e.seriesIndex).classed('hover', true);
        });
        scatter.dispatch.on('elementMouseout.area', function(e) {
          g.select('.area-' + e.seriesIndex).classed('hover', false);
        });

    });


    return chart;
  }


  chart.dispatch = dispatch;
  chart.scatter = scatter;

  d3.rebind(chart, scatter, 'interactive', 'size', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'sizeDomain', 'forceX', 'forceY', 'forceSize', 'clipVoronoi', 'clipRadius');

  chart.x = function(_) {
    if (!arguments.length) return getX;
    getX = d3.functor(_);
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return getY;
    getY = d3.functor(_);
    return chart;
  }

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.clipEdge = function(_) {
    if (!arguments.length) return clipEdge;
    clipEdge = _;
    return chart;
  };

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return chart;
  };

  chart.offset = function(_) {
    if (!arguments.length) return offset;
    offset = _;
    //stacked.offset(offset);
    return chart;
  };

  chart.order = function(_) {
    if (!arguments.length) return order;
    order = _;
    //stacked.order(order);
    return chart;
  };

  //shortcut for offset + order
  chart.style = function(_) {
    if (!arguments.length) return style;
    style = _;

    switch (style) {
      case 'stack':
        chart.offset('zero');
        chart.order('default');
        break;
      case 'stream':
        chart.offset('wiggle');
        chart.order('inside-out');
        break;
      case 'expand':
        chart.offset('expand');
        chart.order('default');
        break;
    }

    return chart;
  };



  scatter.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top],
        dispatch.tooltipShow(e);
  });

  scatter.dispatch.on('elementMouseout.tooltip', function(e) {
        dispatch.tooltipHide(e);
  });


  return chart;
}
