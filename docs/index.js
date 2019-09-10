var filters = {};
var sliders = {};
var weights = {};
var incomes = {};
var collegeData = {};
var collegeScores = {};
var mobilityFilter = 0;

var canvas_width = 600;
var canvas_height = 500;
var padding = 30;  // for chart edges

  // Create scale functions
var xScale = d3.scale.linear()
                .domain([0, 1])
                .range([padding, canvas_width - padding * 2]);

var yScale = d3.scale.linear()
                .domain([0, 1])
                .range([canvas_height - padding, padding]);

setupPage();

function setupPage() {
  loadIncomeData();
  loadCollegeData();
}

function loadIncomeData() {
  d3.json("data/incomes.json", function(json) {
    for (var i in json) {
      var incomeObject = json[i];
      incomes[incomeObject.id] = {...json[i]}
    }
    console.log("income data loaded");
  });
}

function loadCollegeData() {
  d3.csv("data/college_data.csv", function(data) {
    for (var i = 0; i < data.length; i++) {
      var id = data[i].super_opeid;
      collegeData[id] = {...data[i]}
    }
    console.log("college data loaded");
    setupFilters();
    setupSliders();
    createMobilityDropdown();
    createSearchBar();
  });
}

function setupFilters() {
  d3.json("data/filter-options.json", function(json) {
    for (var i in json) {
      var filterObject = json[i];
      createFilterButton(filterObject);
      createFilter(filterObject);
    }
    console.log("filter data loaded");
  });
}

function createFilter(filterObject) {
  var filterContainer = d3.select('#filter-space')
    .append('div')
    .style('display', 'none')
    .attr('class', 'filter-tool')
    .attr('id', filterObject.id);
  var filter = filterContainer.append('div')
    .attr('id', filterObject.id)
    .attr('class', 'filter');
  filter.append('h4').text(filterObject.name);
  filters[filterObject.id] = new Set([]);

  for (var i in filterObject.options) {
    var optionObject = filterObject.options[i];
    filter.append('div')
      .attr('id', optionObject.id)
      .attr('class', 'filter-option active')
      .text(optionObject.name)
      .on("click", flipFilterOptionHandler(filterObject, optionObject));

    filters[filterObject.id].add(optionObject.value);
  }

  weights[filterObject.id] = 1.0;
}

function createFilterButton(sliderObject) {
  var filterButton = d3.select('#filter-buttons')
    .append('div')
    .attr('id', sliderObject.id + '-button')
    .attr('class', 'filter-button')
    .text(sliderObject.name)
    .on('click', clickFilterButtonHandler(sliderObject));
}

function clickFilterButtonHandler(sliderObject) {
  return function() {
    clickFilterButton(sliderObject);
  }
}

function clickFilterButton(sliderObject) {
  d3.selectAll('.filter-button')
    .classed('active', false);
  d3.select('#' + sliderObject.id + '-button')
    .classed("active", true);

  d3.selectAll('.filter-tool').style('display', 'none');
  var filterTool = d3.select("#filter-space")
    .select("#" + sliderObject.id)
    .style('display', 'inline');
}

function flipFilterOptionHandler(filterObject, optionObject) {
  return function() {
    flipFilterOption(filterObject, optionObject);
  }
}

function flipFilterOption(filterObject, optionObject) {
  const active = filters[filterObject.id].has(optionObject.value);
  if (!active) {
    filters[filterObject.id].add(optionObject.value);
  } else {
    filters[filterObject.id].delete(optionObject.value);
  }

  calculateScores(false);

  // Take out colleges that don't match filter
  for (var i in collegeData) {
    var collegeValue = collegeData[i][filterObject.id];
    var filterList = filters[filterObject.id];
    if (!filterList.has(collegeValue)) {
      collegeScores[i] = -1;
    }
  }

  displayResults();
  drawGraph();

  var option = d3.select("#" + optionObject.id)
    .classed("active", !active);
}

function setupSliders() {
  d3.json("data/slider-options.json", function(json) {
    for (var i in json) {
      var sliderObject = json[i];
      createFilterButton(sliderObject);
      createSlider(sliderObject);
      createWeightSlider(sliderObject);
    }
    console.log("slider data loaded");
    calculateScores(false);
    displayResults();
    drawGraph();
    colorButtons();
  });
}

function createSlider(sliderObject) {
  var slider = d3.sliderHorizontal()
    .domain([sliderObject.min,sliderObject.max])
    .default((sliderObject.max+sliderObject.min)/2)
    .width(125)
    .ticks(2)
    .on('onchange', val => {
      sliders[sliderObject.id] = (slider.value()-sliderObject.min)/(sliderObject.max-sliderObject.min);
      calculateScores(true);
      displayResults();
      drawGraph()
    })

  var filterTool = d3.select('#filter-space')
    .append('div')
    .style('display', 'none')
    .attr('class', 'filter-tool')
    .attr('id', sliderObject.id);

  filterTool.append('h3').text('Target Value:');

  var filterValue = filterTool
    .append('div')
    .attr('class', 'filter-slider')
    .append('svg')
    .attr('width', 125)
    .attr('height', 50)
    .append('g')
    .call(slider);

  sliders[sliderObject.id] = (slider.value()-sliderObject.min)/(sliderObject.max-sliderObject.min);
}

function createWeightSlider(sliderObject) {
  var category = d3.select("#" + sliderObject.type);

  var slider = d3.sliderHorizontal()
    .max(1)
    .default(0.5)
    .width(125)
    .ticks(2)
    .fill('rgba(0,180,255,1)')
    .on('onchange', val => {
      weights[sliderObject.id] = slider.value();
      calculateScores(true);
      displayResults();
      drawGraph();
      colorButtons();
    })

  var filterTool = d3.select('#' + sliderObject.id);
  filterTool.append('h3').text('Importance:');

  filterTool
    .append('div')
    .attr('class', 'filter-weight')
    .append('svg')
    .attr('width', 125)
    .attr('height', 50)
    .append('g')
    .call(slider);

  weights[sliderObject.id] = slider.value();
}

function isCollegeMatch(collegeObject) {
  for (var i in filters) {
    const filter = filters[i];
    const collegeValue = collegeObject[i];
    if (!filter.has(collegeValue)) {
      return false;
    }
  }
  return true;
}

function displayResults() {
  d3.select("#num-schools").remove();
  d3.select("#college-list").remove();
  var list = d3.select("#results").append('div')
    .attr('id', 'college-list');

  var result = Object.keys(collegeScores).sort(function(a, b) {
    return collegeScores[b] - collegeScores[a];
  })
  .slice(0,100);

  var counter = 1;
  for (var i in result) {
    var id = Number(result[i]);
    if (typeof collegeData[id] !== "undefined" && collegeScores[id] !== -1) {
      createCollegeEntry(collegeData[id], counter);
      counter = counter + 1;
    }
  }

  d3.select("#results").insert('div', '#college-list')
    .attr('id', 'num-schools');
}

function createCollegeEntry(collegeObject, rank) {
  var list = d3.select("#college-list");
  var collegeEntry = list.append('div')
    .attr('class', 'college-entry')
    .attr('id', 'entry-' + collegeObject['super_opeid'])
    .on('click', clickCollegeEntryHandler(collegeObject));

  var collegeDescription = collegeEntry.append('div')
    .attr('class', 'college-descr');

  collegeDescription.append('div')
    .attr('class', 'college-title')
    .text(rank.toString() + ". " + collegeObject['name']);

  var subtitle = collegeDescription.append('div')
    .attr('class', 'college-subtitle');
  subtitle.append('span').text('State: ' + collegeObject['state']);
  subtitle.append('div').text(collegeObject['tier_name']);
}

function clickCollegeEntryHandler(collegeObject) {
  return function() {
    clickCollegeEntry(collegeObject);
  }
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

function createCollegeDetailsTable(collegeObject) {
  var collegeDetails = d3.select("#school-details")
    .append('div')
    .attr('id', 'details-table');

  collegeDetails.append('h3').text('College Details');

  var collegeDetailsTable = collegeDetails.append('table');

  var row = collegeDetailsTable.append('tr');
  row.append('th').text('State');
  row.append('td').text(collegeObject['state']);

  var row = collegeDetailsTable.append('tr');
  row.append('th').text('Tier');
  row.append('td').text(collegeObject['tier_name']);

  var row = collegeDetailsTable.append('tr');
  row.append('th').text('Enrollment');
  row.append('td').text(formatNumber(collegeObject['ipeds_enrollment_2013']));

  var row = collegeDetailsTable.append('tr');
  row.append('th').text('Sticker Price');
  row.append('td').text('$' + formatNumber(parseFloat(collegeObject['sticker_price_2013']).toFixed(0)));

  var row = collegeDetailsTable.append('tr');
  row.append('th').text('Low-Income Price');
  row.append('td').text('$' + formatNumber(parseFloat(collegeObject['scorecard_netprice_2013']).toFixed(0)));

  var row = collegeDetailsTable.append('tr');
  row.append('th').text('SAT Score');
  row.append('td').text(parseFloat(collegeObject['sat_avg_2013']).toFixed(0));

  var row = collegeDetailsTable.append('tr');
  row.append('th').text('Graduation Rate');
  row.append('td').text((parseFloat(collegeObject['grad_rate_150_p_2013']) * 100).toFixed(0) + '%');

  if (collegeObject['Web']){
    collegeDetails.append('h3').append('a')
      .attr('class','website')
      .text('Website')
      .on("click", function(d) {
          window.open('http://' + collegeObject['Web']);
      });
  }
}

function clickCollegeEntry(collegeObject) {
  var collegeDetails = d3.select('#school-details');
  collegeDetails.html('');

  collegeDetails.append('h2')
    .text(collegeObject['name']);

  createCollegeDetailsTable(collegeObject);

  var color = d3.scaleOrdinal(d3.schemeCategory10);

  // Gender Chart
  var percentFemale = parseFloat(collegeObject['female']).toFixed(2);
  var percentMale = (1 - percentFemale).toFixed(2);
  var genderData = [
    {name: "Female", value: percentFemale},
    {name: "Male",value: percentMale}
  ];
  createDonutChart(genderData, "Gender Ratio", d3.scale.linear()
    .range(["pink", "blue"])
    .domain([0, 1]));

  // Race Chart
  var percentAsian = parseFloat(collegeObject['asian_or_pacific_share_fall_2000']).toFixed(2);
  var percentBlack = parseFloat(collegeObject['black_share_fall_2000']).toFixed(2);
  var percentHispanic = parseFloat(collegeObject['hisp_share_fall_2000']).toFixed(2);
  var percentOther = 1 - (parseFloat(percentBlack) + parseFloat(percentAsian) + parseFloat(percentHispanic));
  var percentOther = percentOther.toFixed(2);
  var raceData = [
    {name: "Asian/Pacific", value: percentAsian},
    {name: "Black", value: percentBlack},
    {name: "Hispanic", value: percentHispanic},
    {name: "Other", value: percentOther}
  ];
  createDonutChart(raceData, "Race Ratio", color);

  // Major Chart
  var percentArt = parseFloat(collegeObject['pct_arthuman_2000']);
  var percentBusiness = parseFloat(collegeObject['pct_business_2000']);
  var percentHealth = parseFloat(collegeObject['pct_health_2000']);
  var percentMulti = parseFloat(collegeObject['pct_multidisci_2000']);
  var percentPublic = parseFloat(collegeObject['pct_publicsocial_2000']);
  var percentStem = parseFloat(collegeObject['pct_stem_2000']);
  var percentSocial = parseFloat(collegeObject['pct_socialscience_2000']);
  var percentTrade = parseFloat(collegeObject['pct_tradepersonal_2000']);
  var percentOther = 1 - (percentArt + percentBusiness + percentHealth + percentMulti + percentPublic + percentStem + percentSocial + percentTrade);
  var majorData = [
    {name: "Humanities", value: percentArt.toFixed(2)},
    {name: "Business", value: percentBusiness.toFixed(2)},
    {name: "Medicine", value: percentHealth.toFixed(2)},
    {name: "Multidisciplinary", value: percentMulti.toFixed(2)},
    {name: "Social Services", value: percentPublic.toFixed(2)},
    {name: "STEM", value: percentStem.toFixed(2)},
    {name: "Social Sciences", value: percentSocial.toFixed(2)},
    {name: "Trade Services", value: percentTrade.toFixed(2)},
    {name: "Other", value: percentOther.toFixed(2)},
  ];
  createDonutChart(majorData, "Major Ratio", color);

  d3.selectAll(".selected-circle")
    .classed("selected-circle", false)
    .attr('r',3)
    .attr('fill','black')
    .attr('opacity',0.5);

  d3.select('#id-' + collegeObject['super_opeid'])
    .classed("selected-circle", true)
    .attr('fill',d3.rgb(255, 223, 0))
    .attr('opacity', 0.8)
    .attr('r',15)
    .raise();

  d3.selectAll('.selected-entry')
    .classed('selected-entry', false);

  d3.select('#entry-' + collegeObject['super_opeid'])
    .classed('selected-entry', true);
}

function createDonutChart(data, heading, color) {
  var collegeDetailsChart = d3.select('#school-details')
    .append('div')
    .attr('class', 'chart');

  collegeDetailsChart.append('h3').text(heading);

  var text = "";

  var width = 200;
  var height = 200;
  var thickness = 40;
  var duration = 750;

  var radius = Math.min(width, height) / 2;

  var svg = collegeDetailsChart
  .append('svg')
  .attr('class', 'pie')
  .attr('width', width)
  .attr('height', height);

  var g = svg.append('g')
  .attr('transform', 'translate(' + (width/2) + ',' + (height/2) + ')');

  var arc = d3.arc()
  .innerRadius(radius - thickness)
  .outerRadius(radius);

  var pie = d3.pie()
  .value(function(d) { return d.value; })
  .sort(null);

  var path = g.selectAll('path')
  .data(pie(data))
  .enter()
  .append("g")
  .on("mouseover", function(d) {
        let g = d3.select(this)
          .style("cursor", "pointer")
          .style("fill", "black")
          .append("g")
          .attr("class", "text-group");

        g.append("text")
          .attr("class", "name-text")
          .text(`${d.data.name}`)
          .attr('text-anchor', 'middle')
          .attr('dy', '-1.2em');

        g.append("text")
          .attr("class", "value-text")
          .text(`${d.data.value}`)
          .attr('text-anchor', 'middle')
          .attr('dy', '.6em');
      })
    .on("mouseout", function(d) {
        d3.select(this)
          .style("cursor", "none")
          .style("fill", color(this._current))
          .select(".text-group").remove();
      })
    .append('path')
    .attr('d', arc)
    .attr('fill', (d,i) => color(i))
    .on("mouseover", function(d) {
        d3.select(this)
          .style("cursor", "pointer")
          .style("fill", "black");
      })
    .on("mouseout", function(d) {
        d3.select(this)
          .style("cursor", "none")
          .style("fill", color(this._current));
      })
    .each(function(d, i) { this._current = i; });


  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '.35em')
    .text(text);
}

function correlationScore(collegeObject) {
  var score = 0;
  var sum_w = 0;
  for (var i in sliders) {
    if (!!collegeObject[i + '_norm']) {
      var dif = 1-Math.abs(sliders[i]-collegeObject[i + '_norm']);
      score += weights[i]*dif;
      sum_w += weights[i];
    }
  }
  return score/sum_w;
}

function calculateScores(checkMatch) {
  for (var i in collegeData) {
    if (checkMatch) {
      if (collegeScores[i] !== -1) {
        collegeScores[i] = correlationScore(collegeData[i]);
      }
    } else {
      collegeScores[i] = correlationScore(collegeData[i]);
    }
  }
}

function colorButtons() {
  for (var f in weights) {
    var op = weights[f] * .9 + .1;
    var filterButton = d3.select('#' + f + '-button')
      .style('background-color', 'rgba(0,180,255,' + op.toString() + ')');
  }
}

function drawGraph() {
  d3.select("#scatterplot").remove();

  var mr = 'mr_q'+mobilityFilter;

  var data = [];
  for (var i in collegeData) {
    data.push([collegeScores[i],collegeData[i][mr],i]);
  }

  var xAxis = d3.axisBottom().scale(xScale).ticks(5);
  var yAxis = d3.axisLeft().scale(yScale).tickFormat(d3.format("")).ticks(5);

  var div = d3.select("#graph").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  var svg = d3.select("#graph")
              .append("svg")
              .attr("id","scatterplot")
              .attr("width", canvas_width)
              .attr("height", canvas_height + padding);

  if(mobilityFilter != 0){
    svg.append('rect')
          .attr("x", 60)
          .attr("y", 470-mobilityFilter*88)
          .attr("height", 88)
          .attr("width", canvas_width-100)
          .attr('fill',d3.rgb(0,180,255))
          .attr('opacity', 0.3);
  }

  svg.selectAll("circle")
     .data(data).enter()
     .append("circle")
     .attr("id", function(d) {
        return "id-" + d[2];
     })
     .attr("cx", function(d) {
        return xScale(d[0]) + padding;
     })
     .attr("cy", function(d) {
        return yScale(d[1]);
     })
     .attr("r", 3)
     .attr("opacity",0.5)
     .on('click', function(d) {
       return clickCollegeEntry(collegeData[d[2]]);
     })
     .on("mouseover", function(d) {
            div.transition()
                .duration(200)
                .style("opacity", .9);
            div.html(collegeData[d[2]]['name'])
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
            })
      .on("mouseout", function(d) {
          div.transition()
             .duration(500)
             .style("opacity", 0);
      });

   svg.append("g")
      .attr("transform", "translate(" + padding + "," + (canvas_height - padding) +")")
      .call(xAxis);

    var xlabel = svg.append("text")
      .attr("transform",
            "translate(" + (canvas_width/2 + padding) + " ," +
                           (canvas_height - padding/2 + 20) + ")")
      .style("text-anchor", "middle")
      .html("Match Score &#x2753;")
      .on('mouseover', function() {
        div.transition()
            .duration(200)
            .style("opacity", .9);
        div.html('The match score is calculated based on how closely the college matches the selected filter criteria, weighted by how important each filter is.')
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 28) + "px");
        })
      .on("mouseout", function(d) {
          div.transition()
             .duration(500)
             .style("opacity", 0);
      });

  svg.append("g")
      .attr("transform", "translate(" + (2*padding) +",0)")
      .call(yAxis);

  svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0)
      .attr("x",0 - (canvas_height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .html("Projected Income Rank &#x2753;")
      .on('mouseover', function() {
        div.transition()
            .duration(200)
            .style("opacity", .9);
        div.html('Income rank shows the percentile (compared to the US overall) of how much money students attending a given college make after graduation.')
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 28) + "px");
        })
      .on("mouseout", function(d) {
          div.transition()
             .duration(500)
             .style("opacity", 0);
      });
}

function createSearchBar() {
  var search = d3.select('#results-container')
    .insert('div', '#results')
    .attr('id', 'search-bar');

  var input = search.append('input')
    .attr('type', 'text')
    .attr('id', 'search-input')
    .attr('placeholder', 'Search for a college...')
    .on('keyup', function() {
      var inputValue = d3.select('#search-input').property('value').toLowerCase();

      for (var i in collegeData) {
        var name = collegeData[i]['name'].toLowerCase();
        var id = collegeData[i]['super_opeid'];
        var collegeEntry = d3.select('#results').select('#entry-' + id);
        if (name.indexOf(inputValue) > -1) {
          collegeEntry.style('display', '');
        } else {
          collegeEntry.style('display', 'none');
        }
      }
    });
}

function createMobilityDropdown() {
  var dropdown = d3.select("#mobility-dropdown").append('div').attr('id', 'dropdown');

  var dropdownButton = dropdown.append('div')
    .attr('id', 'dropdown-button');
  changeMobilityButton(dropdownButton);

  var dropdownMenu = dropdown.append('div')
    .attr('id', 'dropdown-menu');

  for (var i = 0; i < 6; i++) {
    dropdownMenu.append('div')
      .attr('class', 'dropdown-menu-entry')
      .attr('id', i)
      .text(incomes[i]['name'])
      .on('click', function() {
        mobilityFilter = this['id'];
        drawGraph();
        changeMobilityButton(dropdownButton);
      });
  }
}

function changeMobilityButton(button) {
  button.text(incomes[mobilityFilter]['name']);
  button.append('span')
    .attr('class', 'icon')
    .html('&#9662;');
}
