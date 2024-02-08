const parse5 = require("parse5");
import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError
} from "../controller/IInsightFacade";
let finalMap = {};
let fs = require("fs");

function buildingHelper(fileData: any, that: any, tBody: any, buildings: any) {
	let docIndex: any = parse5.parse(fileData.pop());
	that.docHelper(tBody, docIndex, "tbody");
	for (let element of tBody.childNodes) {
		if (element.nodeName === "tr") {
			let aBuilding: any = {};
			for (let entry of element.childNodes) {
				if (typeof entry.attrs !== "undefined") {
					aBuilding = getBuildingAttrs(entry, aBuilding);
				}
			}
			buildings[aBuilding["fullname"]] = aBuilding;
		}
	}
	return buildings;
}

function mappingData(fileData: any, that: any, roomInfo: any[], map: any, buildings: any) {
	fileData.forEach(function (data: any) {
		let document: any = parse5.parse(data);
		let buffer: any = {};
		that.docHelper(buffer, document, "tbody");
		if (Object.keys(buffer).length !== 0) {
			roomInfo.push(document);
		}
	});

	for (let entry of roomInfo) {
		let roomInA: any = {};
		let section: any = {};
		that.docHelper(section, entry, "section");
		let buildingInfo: any = {};
		that.roomHelper(buildingInfo, section, "building-info");
		for (let element of buildingInfo.childNodes) {
			map = addRoomElement(element, buildings, that, roomInA, section, map);
		}
	}
	return map;
}

function finalResponse
(map: any, response: any, kind: InsightDatasetKind, jsonObj: any, id: string, returnIds: string[]) {
	if (Object.keys(map).length === 0) {
		response.code = 400;
		response.body = {error: "The input file is empty."};
		return response;
	} else {
		if (fs.existsSync(__dirname + "/../../data/" + kind + ".json")) {
			console.log("file exists");
			jsonObj.push({id: id, data: map});
			console.log("data equal to" + jsonObj[1]);
			fs.writeFileSync(__dirname + "/../../data/" + kind + ".json", JSON.stringify(jsonObj), "utf8");
		} else {
			console.log("file does not exist");
			finalMap = [{id: id, data: map}];
			if (!fs.existsSync(__dirname + "/../../data/")) {
				fs.mkdirSync(__dirname + "/../../data/");
			}
			fs.writeFileSync(__dirname + "/../../data/" + kind + ".json", JSON.stringify(finalMap), "utf8");
		}
		returnIds.push(id);
		return returnIds;
	}
}

function addRoomElement(element: any, buildings: any, that: any, roomInA: any, section: any, map: any) {
	if (typeof element.attrs !== "undefined") {
		if (element.attrs.length === 0) {
			if (element.childNodes[0].childNodes[0].value in buildings) {
				let fullname: string = element.childNodes[0].childNodes[0].value;
				let shortname: string = buildings[fullname]["shortname"];
				let address: string = buildings[fullname]["address"];
				that.docHelper(roomInA, section, "tbody");
				for (let elementChild of roomInA.childNodes) {
					if (elementChild.nodeName === "tr") {
						let roomA: any = {};
						roomA["rooms_fullname"] = fullname;
						roomA["rooms_shortname"] = shortname;
						roomA["rooms_address"] = address;
						roomA["rooms_lat"] = buildings[fullname]["lat"];
						roomA["rooms_lon"] = buildings[fullname]["lon"];
						for (let entry of elementChild.childNodes) {
							if (typeof entry.attrs !== "undefined") {
								if (entry.attrs[0].value === "views-field views-field-field-room-number") {
									roomA["rooms_href"] = entry.childNodes[1].attrs[0].value;
									roomA["rooms_number"] = entry.childNodes[1].childNodes[0].value;
									roomA["rooms_name"] = shortname + "_" + roomA["rooms_number"];
								}
								if (entry.attrs[0].value === "views-field views-field-field-room-capacity") {
									roomA["rooms_seats"] = entry.childNodes[0].value.trim();
									roomA["rooms_seats"] = parseInt(roomA["rooms_seats"], 10);
								}
								if (entry.attrs[0].value === "views-field views-field-field-room-furniture") {
									roomA["rooms_furniture"] = entry.childNodes[0].value.trim();
								}
								if (entry.attrs[0].value === "views-field views-field-field-room-type") {
									roomA["rooms_type"] = entry.childNodes[0].value.trim();
								}
							}
						}
						map[roomA["rooms_name"]] = roomA;
					}
				}
			}
		}
	}
	return map;
}

function getBuildingAttrs(entry: any, aBuilding: any) {
	if (entry.attrs[0].value === "views-field views-field-field-building-code") {
		aBuilding["shortname"] = entry.childNodes[0].value.trim();
	}
	if (entry.attrs[0].value === "views-field views-field-title") {
		aBuilding["fullname"] = entry.childNodes[1].childNodes[0].value;
		aBuilding["href"] = entry.childNodes[1].attrs[0].value;
	}
	if (entry.attrs[0].value === "views-field views-field-field-building-address") {
		aBuilding["address"] = entry.childNodes[0].value.trim();
	}
	return aBuilding;
}

async function addDatasetHelper
(id: string, fileData: any, kind: InsightDatasetKind, jsonObj: any, returnIds: any):	Promise<string[]> {
	let map: any = {};
	if (kind === InsightDatasetKind.Courses) {
		fileData.forEach(function (element: any) {
			try {
				if (element) {
					let data = JSON.parse(element)["result"];
					for (let item of data) {
						let uid: string = item["id"].toString();
						map[uid] = {
							courses_dept: item["Subject"],
							courses_id: item["Course"],
							courses_avg: item["Avg"],
							courses_instructor: item["Professor"],
							courses_title: item["Title"],
							courses_pass: item["Pass"],
							courses_fail: item["Fail"],
							courses_audit: item["Audit"],
							courses_uuid: item["id"].toString(),
							courses_year: item["Section"] === "overall" ? 1900 : item["Year"],
							courses_size: (item["Pass"] + item["Fail"]).toString()
						};
					}
				}
			} catch (err) {
				return Promise.reject(new InsightError("invalid"));
			}
		});
		if (Object.keys(map).length === 0) {
			return Promise.reject(new InsightError("No data in the file"));
		} else {
			// Add the id as the key and the JSON object as the value
			if (fs.existsSync(__dirname + "/../../data/" + kind + ".json")) {
				console.log("file exists");
				jsonObj.push({id: id, data: map});
				fs.writeFileSync(__dirname + "/../../data/" + kind + ".json", JSON.stringify(jsonObj), "utf8");
			} else {
				console.log("file doesn't exists");
				finalMap = [{id: id, data: map}];
				if (!fs.existsSync(__dirname + "/../../data/")) {
					fs.mkdirSync(__dirname + "/../../data/");
				}
				fs.writeFileSync(__dirname + "/../../data/" + kind + ".json", JSON.stringify(finalMap), "utf8");
			}
			returnIds.push(id);
		}
	}
	return Promise.resolve(returnIds);
}

function validateId(id: string, kind: string) {
	let returnIds: string[] = [];
	let jsonObj: Array<{id: string; data: object}> = [];
	if (id === " " || id.includes("_") === true
		|| id === undefined || id === null || id === "") {
		return "invalid id";
	}

	if (fs.existsSync(__dirname + "/../../data/" + kind + ".json")) {
		console.log("data exists");
		let jsonData = fs.readFileSync(__dirname + "/../../data/" + kind + ".json", "utf8");
		jsonObj = JSON.parse(jsonData);
		for (let key of jsonObj) {
			returnIds.push(key.id);
			if (key.id === id) {
				return "ID already exists";
			}
		}
	}
	return {jsonObj, returnIds};
}

export {
	buildingHelper, getBuildingAttrs, finalResponse, mappingData, validateId, addDatasetHelper
};
