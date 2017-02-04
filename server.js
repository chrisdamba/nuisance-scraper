var express = require('express');
var fs      = require('fs');
var async   = require('async');
var request = require('request');
var rp      = require('request-promise');
var cheerio = require('cheerio');
var MongoClient = require('mongodb').MongoClient;

var app     = express();
var mongoUrl = 'mongodb://localhost:27017/test';

function httpGet(obj, callback) {

  	request(obj.url, function(err, res, body) {
      	var $ = cheerio.load(body);
      	var json = [];

		$("div.ci").each(function(i, el){
			var content = $(el);
			var user = content.find("span.byn").children().first().text();
			var timestamp = content.find("span.byt").text();
			var comment = content.find("div.qt").text().replace(/(?:\\[rn]|[\r\n]+)+/g, "");

			json.push({
				user: user,
				timestamp: timestamp,
				comment: comment,
				updatedAt: new Date()
			});
		});
      	obj.comments = json;
      	callback(err, obj);
    });
}

function getComments(obj, callback) {

  	request(obj.url, function(err, res, body) {
      	var $ = cheerio.load(body);
      	var json = [];

		$("table.comment").each(function(i, el){
			var content = $(el);
			var user = content.find("div.posternickname").text().replace("&nbsp;", "").replace(/(?:\\[rn]|[\r\n]+)+/g, "").trim();
			var timestamp = content.find("div.commenttime").text().replace(/(?:\\[rn]|[\r\n]+)+/g, "").trim();
			var comment = content.find("span.comment").text().replace("&nbsp;", "").replace(/(?:\\[rn]|[\r\n]+)+/g, "").trim();

			json.push({
				user: user,
				timestamp: timestamp,
				comment: comment,
				updatedAt: new Date()
			});
		});
      	obj.comments = json;
      	callback(err, obj);
    });
}

function createNewEntries(db, entries, callback) {
	var collection = db.collection('phones');

	var ops = entries.map(function(data) {
		return { 
			"updateOne": { 
				"filter": { "number": data.number }, 
				"update": data,
				"upsert": true
			} 
		};
	});

	collection.bulkWrite(ops, function(err, r) {
		if (err) throw err;		
		callback();
	});    
};

app.get('/scrape', function(req, res){	
	//url = 'http://www.unknownphone.com/';
	//url = 'http://who-called.co.uk/';
	var url = 'http://uk.whocalledme.net',
		options = {
			method: 'GET',
			url: url,
			gzip: true
		};

	rp(options).then(function(html){
		var $ = cheerio.load(html);             
		var numbers = $('div.ni');      
		var data = [];
		
		numbers.each(function(i, el){
			var div = $(el),				
				number = div.find("div.tl h4 a").text(),
				link = url + div.find("div.tl h4 a").attr("href");                

			data.push({
				url: link,
				number: number
			}); 
		});   

		async.map(data, httpGet, function (err, result){
			if (err) throw err;
			MongoClient.connect(mongoUrl, function(err, db) {
				createNewEntries(db, result, function() {
					console.log("DB updated!");
					db.close();
				});
			});
		});

	}).catch(function(error){
		throw error;
	});

	res.send('Check your database!');
	
})

app.get('/scrape2', function(req, res){		
	var url = 'http://www.whosenumberisthis.co.uk/',
		options = {
			method: 'GET',
			url: url
		};

	rp(options).then(function(html){
		
		var $ = cheerio.load(html);             
		var numbers = $('table.comment');      
		var data = [];
		
		numbers.each(function(i, el){
			var table = $(el),				
				number = table.find("tr").first().find("td div a").text(),
				link = table.find("tr").first().find("td div a").attr("href");                

			data.push({
				url: link,
				number: number
			}); 
		});   		

		async.map(data, getComments, function (err, result){
			if (err) throw err;
			MongoClient.connect(mongoUrl, function(err, db) {
				createNewEntries(db, result, function() {
					console.log("DB updated!");
					db.close();
				});
			});
		});
		

	}).catch(function(error){
		throw error;
	});

	res.send('Check your database!');
	
})

app.listen('8081')
console.log('Magic happens on port 8081');
exports = module.exports = app;
