var chart = null;
var ctx = null;
var interval = 60; //60 seconds
var intervalWidth = 0;
var candlesData = null;
var chartHeight = 0;
var chartWidth = 0;
var volumeHeight = 0;
var infoHeight = 0;
var rectHeight = 0;
var realVolumeHeight = 0;
var candleWidth = 10;
var horizontalVolumeStep = 0.5;
var pipHeight = 0;
var allPriceLevels = [];

var intervalsCount = 0;
var globalMaxPrice = 0;
var globalMinPrice = 0;
var maxVolume = 0;
var maxHorizontalVolume = 0;
var maxHorizontalVolumeByPrice = 0;
//var since = 1510334400;
//var till = 1510335000;
//var till = Math.floor(Date.now() / 1000);
var till = Math.ceil(Date.now() / (60 * 1000)) * 60;
var since = till - 600;
var lastTill = 0;
var horizontalVolumeWidth = 200;
var horizontalBuyVolumesByPrice = {};
var horizontalSellVolumesByPrice = {};
var jsonData = {};
var timerId = null;
var getNewDataInterval = 1;
var colored = true;

var X = 0;
var Y = 0;
var greenColor = "#00cc00";
var redColor = "#ff3333";
var orangeColor = "#e65c00";

function getData(tillNow) {
    clearInterval(timerId);

    if (tillNow) {
        till = Math.ceil(Date.now() / (60 * 1000)) * 60;
        lastTill = Math.floor(Date.now() / 1000) - 5;
    } else {
        lastTill = till;
    }

    $.ajax({
        url: "get_data.php",
        data: {
            since: since, till: lastTill
        }
    }).done(function (data) {
        chart = document.getElementById("chart");
        ctx = chart.getContext('2d');

        jsonData = JSON.parse(data);
        initData();
        repaint();
        chart.onmousemove = handleMousemove;
        chart.onmouseleave = handleMousemove;

        if (tillNow) timerId = setInterval(getNewData, getNewDataInterval * 1000);
    });
}

function getNewData() {
    var newSince = lastTill;
    //lastTill = Math.floor(Date.now() / 1000);
    lastTill = newSince + getNewDataInterval;
    if (lastTill == newSince) return;

    $.ajax({
        url: "get_data.php",
        data: {
            since: newSince, till: lastTill, new_data: '1'
        }
    }).done(function (data) {
        if (lastTill > till) {
            till += interval;
            since += interval;

            var toIndex = 0;
            for (i = 0; i < jsonData.length; i++) {
                var trade = jsonData[i];
                var timestamp = parseInt(trade['timestamp'], 10);
                if (timestamp >= since) {
                    toIndex = i;
                    break;
                }
            }
            jsonData.splice(0, toIndex);
        }

        var parsedData = JSON.parse(data);

        parsedData.forEach(function (v) {
            jsonData.push(v)
        });

        initData();
        handleMousemove();

        for (i = 0; i < parsedData.length; i++) {
            var trade = parsedData[i];
            var color = '';
            if (trade['side'] == 'Buy') {
                color = greenColor;
            } else if (trade['side'] == 'Sell') {
                color = redColor;
            }
            var nf = new Intl.NumberFormat();
            var size = nf.format(trade['size']);
            var time = moment(new Date(trade['timestamp'] * 1000)).format('HH:mm:ss');
            $('<tr style="color:' + color + '"><td>' + trade['price'] + '</td><td>' + size + '</td><td>' + time + '</td></tr>').prependTo("#trades tbody");
        }

        var table = document.getElementById('trades');
        while (table.rows.length > 44) {
            table.deleteRow(-1);
        }
    });
}

function initData() {
    intervalsCount = (till - since) / interval;

    var map = {};
    for (var k = 0; k < intervalsCount; k++) {
        var intervalStart = since + k * interval;
        var intervalEnd = intervalStart + interval;
        map[intervalStart] = [];

        for (i = 0; i < jsonData.length; i++) {
            var trade = jsonData[i];
            var timestamp = parseInt(trade['timestamp'], 10);
            if (timestamp >= intervalStart && timestamp < intervalEnd) {
                map[intervalStart].push(trade);
            }
        }
    }

    globalMaxPrice = parseFloat(jsonData[0]['price']);
    globalMinPrice = parseFloat(jsonData[0]['price']);
    for (var i = 0; i < jsonData.length; i++) {
        trade = jsonData[i];
        var price = parseFloat(trade['price']);
        if (price < globalMinPrice) globalMinPrice = price;
        if (price > globalMaxPrice) globalMaxPrice = price;
    }

    maxVolume = 0;
    for (var prop in map) {
        var trades = map[prop];
        var volume = 0;
        for (var key in trades) {
            trade = trades[key];
            volume += parseInt(trade['size'], 10);
        }
        if (volume > maxVolume) maxVolume = volume;
    }

    allPriceLevels = [];
    horizontalBuyVolumesByPrice = {};
    horizontalSellVolumesByPrice = {};
    var currentPriceLevel = 0;
    while (currentPriceLevel <= globalMaxPrice) {
        if (currentPriceLevel >= globalMinPrice) {
            allPriceLevels.push(currentPriceLevel);
            horizontalBuyVolumesByPrice[currentPriceLevel] = 0;
            horizontalSellVolumesByPrice[currentPriceLevel] = 0;
        }
        currentPriceLevel += horizontalVolumeStep;
    }

    candlesData = [];
    for (var prop in map) {
        trades = map[prop];
        if (trades.length == 0) {
            candlesData.push([0, 0, 0, 0, 0, 0, prop, {}, {}]);
            continue;
        }

        var openPrice = parseFloat(trades[0]['price']);
        var closePrice = parseFloat(trades[trades.length - 1]['price']);
        var minPrice = openPrice, maxPrice = openPrice;
        var buyVolume = 0;
        var sellVolume = 0;
        for (var key in trades) {
            trade = trades[key];
            price = parseFloat(trade['price']);
            if (price < minPrice) minPrice = price;
            if (price > maxPrice) maxPrice = price;

            if (trade['side'] == 'Buy') {
                buyVolume += parseInt(trade['size'], 10);
            } else if (trade['side'] == 'Sell') {
                sellVolume += parseInt(trade['size'], 10);
            }
        }

        var horizontalBuyVolumes = {};
        var horizontalSellVolumes = {};
        var firstPriceLevel = true;
        for (i = 0; i < allPriceLevels.length; i++) {
            var currentPriceLevel = allPriceLevels[i];
            if (currentPriceLevel >= minPrice && currentPriceLevel <= maxPrice) {
                var horizontalBuyVolume = 0;
                var horizontalSellVolume = 0;
                for (key in trades) {
                    trade = trades[key];
                    price = parseFloat(trade['price']);
                    var startPriceLevel = firstPriceLevel ? minPrice : currentPriceLevel;
                    if (price >= startPriceLevel && price < currentPriceLevel + horizontalVolumeStep) {
                        if (trade['side'] == 'Buy') {
                            horizontalBuyVolume += parseInt(trade['size'], 10);
                        } else if (trade['side'] == 'Sell') {
                            horizontalSellVolume += parseInt(trade['size'], 10);
                        }
                    }
                }

                var horizontalVolume = horizontalBuyVolume + horizontalSellVolume;
                if (horizontalVolume > maxHorizontalVolume) maxHorizontalVolume = horizontalVolume;
                horizontalBuyVolumes[currentPriceLevel] = horizontalBuyVolume;
                horizontalSellVolumes[currentPriceLevel] = horizontalSellVolume;
                horizontalBuyVolumesByPrice[currentPriceLevel] += horizontalBuyVolume;
                horizontalSellVolumesByPrice[currentPriceLevel] += horizontalSellVolume;
                firstPriceLevel = false;
            }
        }

        candlesData.push([openPrice, closePrice, minPrice, maxPrice, buyVolume, sellVolume, prop, horizontalBuyVolumes, horizontalSellVolumes]);
    }

    maxHorizontalVolumeByPrice = 0;
    for (currentPriceLevel in horizontalBuyVolumesByPrice) {
        var volume = horizontalBuyVolumesByPrice[currentPriceLevel] + horizontalSellVolumesByPrice[currentPriceLevel];
        if (volume > maxHorizontalVolumeByPrice) maxHorizontalVolumeByPrice = volume;
    }
}

function repaint() {
    chartHeight = 500;
    chartWidth = 1000;
    volumeHeight = 300;
    infoHeight = 60;

    chart.width = chartWidth + 60 + horizontalVolumeWidth;
    chart.height = chartHeight + volumeHeight + infoHeight;
    rectHeight = chartHeight - 14;

    ctx.font = '14px sans-serif';

    ctx.clearRect(0, 0, chart.width, chart.height);

    ctx.strokeRect(0, 0, chartWidth , rectHeight);
    ctx.fillText(moment(new Date(since * 1000)).format('HH:mm'), 0, chartHeight);
    ctx.fillText(moment(new Date(till * 1000)).format('HH:mm'), chartWidth - 34, chartHeight);

    realVolumeHeight = volumeHeight - 3;
    ctx.strokeRect(0, chartHeight + 3, chartWidth, realVolumeHeight);

    intervalWidth = chartWidth / intervalsCount;

    pipHeight = rectHeight / (globalMaxPrice - globalMinPrice);

    var textX = chartWidth + 3;
    ctx.fillText("0", textX, chartHeight + volumeHeight);
    ctx.fillText(abbrNum(maxVolume, 2), textX, chartHeight + 14);

    ctx.fillText(globalMinPrice.toString(), textX, chartHeight - 14);
    ctx.fillText(globalMaxPrice.toString(), textX, 12);

    var count = 0;
    for (var i = 0; i < candlesData.length; i++) {
        var candleData = candlesData[i];

        var openPrice = candleData[0];
        var closePrice = candleData[1];
        var minPrice = candleData[2];
        var maxPrice = candleData[3];
        var buyVolume = candleData[4];
        var sellVolume = candleData[5];
        var prop = candleData[6];
        var horizontalBuyVolumes = candleData[7];
        var horizontalSellVolumes = candleData[8];

        var topPrice = Math.max(openPrice, closePrice);
        var candleHeight = Math.abs(openPrice - closePrice) * pipHeight;

        var y = (globalMaxPrice - topPrice) * pipHeight;

        if (openPrice == closePrice) {
            ctx.fillStyle = "#000000";
            candleHeight = 1;
        } else if (openPrice > closePrice) {
            ctx.fillStyle = redColor;
        } else if (closePrice > openPrice) {
            ctx.fillStyle = greenColor;
        }
        ctx.fillRect(count * intervalWidth + 2, y, candleWidth, candleHeight);

        var upperY = (globalMaxPrice - maxPrice) * pipHeight;
        if (upperY == 0) upperY = 2;
        var lowerY = (globalMaxPrice - minPrice) * pipHeight;
        if (minPrice == globalMinPrice) lowerY -= 2;

        //upper shadow
        ctx.strokeStyle = "#000000";
        var x = count * intervalWidth + 2 + candleWidth / 2;
        ctx.moveTo(x, y);
        ctx.lineTo(x, upperY);
        ctx.stroke();

        //lower shadow
        ctx.moveTo(x, y + candleHeight);
        ctx.lineTo(x, lowerY);
        ctx.stroke();

        if (colored) {
            //buy volume
            ctx.fillStyle = greenColor;
            var buyVolumeHeight = (buyVolume * realVolumeHeight) / maxVolume;
            ctx.fillRect(count * intervalWidth + 2, (chartHeight + volumeHeight) - buyVolumeHeight - 1, candleWidth, buyVolumeHeight);

            //sell volume
            ctx.fillStyle = redColor;
            var sellVolumeHeight = (sellVolume * realVolumeHeight) / maxVolume;
            if (buyVolume + sellVolume == maxVolume) sellVolumeHeight -= 3;
            ctx.fillRect(count * intervalWidth + 2, (chartHeight + volumeHeight) - buyVolumeHeight - 1 - sellVolumeHeight, candleWidth, sellVolumeHeight);

            //horizontal volumes
            var horizontalVolumeHeight = intervalWidth - candleWidth - 4;
            for (var currentPriceLevel in horizontalBuyVolumes) {
                ctx.fillStyle = greenColor;
                var horizontalBuyVolume = horizontalBuyVolumes[currentPriceLevel];
                var horizontalBuyVolumeWidth = (horizontalBuyVolume * horizontalVolumeHeight) / maxHorizontalVolume;
                y = (globalMaxPrice - currentPriceLevel) * pipHeight;
                ctx.fillRect(count * intervalWidth + candleWidth + 4, y - 2, horizontalBuyVolumeWidth, 4);

                ctx.fillStyle = redColor;
                var horizontalSellVolume = horizontalSellVolumes[currentPriceLevel];
                var horizontalSellVolumeHeight = (horizontalSellVolume * horizontalVolumeHeight) / maxHorizontalVolume;
                ctx.fillRect(count * intervalWidth + candleWidth + 4 + horizontalBuyVolumeWidth, y - 2, horizontalSellVolumeHeight, 4);
            }

            for (currentPriceLevel in horizontalBuyVolumesByPrice) {
                ctx.fillStyle = greenColor;
                var horizontalBuyVolumeByPrice = horizontalBuyVolumesByPrice[currentPriceLevel];
                var horizontalBuyVolumeWidth = (horizontalBuyVolumeByPrice * horizontalVolumeWidth) / maxHorizontalVolumeByPrice;
                y = (globalMaxPrice - currentPriceLevel) * pipHeight;
                ctx.fillRect(chartWidth + 60, y - 2, horizontalBuyVolumeWidth, 4);

                ctx.fillStyle = redColor;
                var horizontalSellVolumeByPrice = horizontalSellVolumesByPrice[currentPriceLevel];
                var horizontalSellVolumeWidth = (horizontalSellVolumeByPrice * horizontalVolumeWidth) / maxHorizontalVolumeByPrice;
                ctx.fillRect(chartWidth + 60 + horizontalBuyVolumeWidth, y - 2, horizontalSellVolumeWidth, 4);
            }
        } else {
            ctx.fillStyle = orangeColor;
            var buySellVolumeHeight = (buyVolume + sellVolume) * realVolumeHeight / maxVolume;
            if (buyVolume + sellVolume == maxVolume) buySellVolumeHeight -= 3;
            ctx.fillRect(count * intervalWidth + 2, (chartHeight + volumeHeight) - buySellVolumeHeight - 1, candleWidth, buySellVolumeHeight);

            var horizontalVolumeHeight = intervalWidth - candleWidth - 4;
            for (var currentPriceLevel in horizontalBuyVolumes) {
                ctx.fillStyle = orangeColor;
                var horizontalBuySellVolume = horizontalBuyVolumes[currentPriceLevel] + horizontalSellVolumes[currentPriceLevel];
                var horizontalBuySellVolumeWidth = horizontalBuySellVolume * horizontalVolumeHeight / maxHorizontalVolume;
                y = (globalMaxPrice - currentPriceLevel) * pipHeight;
                ctx.fillRect(count * intervalWidth + candleWidth + 4, y - 2, horizontalBuySellVolumeWidth, 4);
            }

            for (currentPriceLevel in horizontalBuyVolumesByPrice) {
                ctx.fillStyle = orangeColor;
                var horizontalBuySellVolumeByPrice = horizontalBuyVolumesByPrice[currentPriceLevel] + horizontalSellVolumesByPrice[currentPriceLevel];
                var horizontalBuySellVolumeWidth = horizontalBuySellVolumeByPrice * horizontalVolumeWidth / maxHorizontalVolumeByPrice;
                y = (globalMaxPrice - currentPriceLevel) * pipHeight;
                ctx.fillRect(chartWidth + 60, y - 2, horizontalBuySellVolumeWidth, 4);
            }
        }

        count++;
    }
}

function handleMousemove(e) {
    if (typeof e !== 'undefined') {
        X = e.pageX - 11;
        Y = e.pageY - 56;
    }

    repaint();

    var y = chartHeight + volumeHeight;
    if (Y < 0 || (Y >= rectHeight && Y <= chartHeight + 3) || Y >= y) return;

    var index = Math.floor(X / intervalWidth);
    var candleData = candlesData[index];
    if (typeof candleData === 'undefined') return;
    var openPrice = candleData[0];
    var closePrice = candleData[1];
    var minPrice = candleData[2];
    var maxPrice = candleData[3];
    var buyVolume = candleData[4];
    var sellVolume = candleData[5];
    var intervalStart = candleData[6];
    var horizontalBuyVolumes = candleData[7];
    var horizontalSellVolumes = candleData[8];

    var rowHeight = 20;
    ctx.fillStyle = "#000000";
    ctx.fillText("Open " + openPrice + "   Close " + closePrice + "   Low " + minPrice + "   High " + maxPrice, 0, y + rowHeight);
    ctx.fillText("Buy " + abbrNum(buyVolume, 2) + "   Sell " + abbrNum(sellVolume, 2) + "   Total " + abbrNum(buyVolume + sellVolume, 2), chartWidth - 600, y + rowHeight);
    ctx.fillText(moment.unix(intervalStart).format("YYYY-MM-DD HH:mm:ss"), chartWidth - 128, y + rowHeight);

    var currentPrice = globalMaxPrice - Y / pipHeight;
    var currentPriceLevel = 0;
    for (var i = 0; i < allPriceLevels.length; i++) {
        currentPriceLevel = allPriceLevels[i];
        if (currentPrice >= currentPriceLevel && currentPrice < currentPriceLevel + horizontalVolumeStep) {
            var horizontalBuyVolumeByPrice = horizontalBuyVolumesByPrice[currentPriceLevel];
            var horizontalSellVolumeByPrice = horizontalSellVolumesByPrice[currentPriceLevel];
            ctx.fillText("Volume by price:   Buy " + abbrNum(horizontalBuyVolumeByPrice, 2) + "   Sell " + abbrNum(horizontalSellVolumeByPrice, 2) + "   Total " +
                abbrNum(horizontalBuyVolumeByPrice + horizontalSellVolumeByPrice, 2), chartWidth - 600, y + 2 * rowHeight);

            var horizontalBuyVolume = horizontalBuyVolumes[currentPriceLevel];
            if (typeof horizontalBuyVolume === 'undefined') break;
            var horizontalSellVolume = horizontalSellVolumes[currentPriceLevel];
            ctx.fillText("Horizontal volume:   Buy " + abbrNum(horizontalBuyVolume, 2) + "   Sell " + abbrNum(horizontalSellVolume, 2) + "   Total " +
                abbrNum(horizontalBuyVolume + horizontalSellVolume, 2), 0, y + 2 * rowHeight);
            break;
        }
    }

    ctx.setLineDash([6, 3]);
    ctx.moveTo(intervalWidth * index + 2 + candleWidth * 0.5, 0);
    ctx.lineTo(intervalWidth * index + 2 + candleWidth * 0.5, y);
    ctx.stroke();

    if (Y >= 0 && Y < rectHeight) {
        var priceLevelY = (globalMaxPrice - currentPriceLevel) * pipHeight;
        ctx.moveTo(0, priceLevelY);
        ctx.lineTo(chart.width, priceLevelY);
        ctx.stroke();

        ctx.font = '12px sans-serif';

        ctx.fillStyle = "#777777";
        ctx.fillRect(chartWidth + 2, priceLevelY - 7, 50, 14);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(currentPriceLevel.toFixed(1).toString(), chartWidth + 8, priceLevelY + 4);
    } else if (Y > chartHeight + 3 && Y < y) {
        ctx.moveTo(0, Y);
        ctx.lineTo(chartWidth, Y);
        ctx.stroke();

        ctx.font = '12px sans-serif';

        var volumeY = Y - (chartHeight + 3);
        var currentVolume = maxVolume - maxVolume * volumeY / realVolumeHeight;
        ctx.fillStyle = "#777777";
        ctx.fillRect(chartWidth + 2, Y - 7, 50, 14);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(abbrNum(currentVolume, 2), chartWidth + 8, Y + 4);
    }
    ctx.setLineDash([]);
}

function abbrNum(number, decPlaces) {
    // 2 decimal places => 100, 3 => 1000, etc
    decPlaces = Math.pow(10,decPlaces);

    // Enumerate number abbreviations
    var abbrev = [ "k", "m", "b", "t" ];

    // Go through the array backwards, so we do the largest first
    for (var i=abbrev.length-1; i>=0; i--) {

        // Convert array index to "1000", "1000000", etc
        var size = Math.pow(10,(i+1)*3);

        // If the number is bigger or equal do the abbreviation
        if(size <= number) {
            // Here, we multiply by decPlaces, round, and then divide by decPlaces.
            // This gives us nice rounding to a particular decimal place.
            number = Math.round(number*decPlaces/size)/decPlaces;

            // Handle special case where we round up to the next abbreviation
            if((number == 1000) && (i < abbrev.length - 1)) {
                number = 1;
                i++;
            }

            // Add the letter for the abbreviation
            number += abbrev[i];

            // We are done... stop
            break;
        }
    }

    return number;
}