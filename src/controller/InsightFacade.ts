import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError
} from "./IInsightFacade";
import {buildingHelper, finalResponse, mappingData, validateId, addDatasetHelper} from "../util/helper";
import http = require("http");

interface GeoResponse {
	lat?: number;
	lon?: number;
	error?: string;
}

import path from "path";

let finalMap = {};
let JSZIP = require("jszip");
let fs = require("fs");
import {Query} from "./Query";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */


export default class InsightFacade implements IInsightFacade {
	constructor() {
		console.log("InsightFacadeImpl::init()");
	}

	public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (kind === InsightDatasetKind.Courses) {
			return this.addDatasetCourses(id, content, kind);
		} else {
			return this.addDatasetRooms(id, content, kind);
		}
	}

	public addDatasetRooms(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		return new Promise((resolve, reject) => {
			let returnIds: string[] = [];
			let jsonObj: Array<{id: string; data: object}> = [];
			const response = {code: 0, body: {}};
			const returnObj = validateId(id, kind);
			if (typeof returnObj === "string") {
				return reject(new InsightError(returnObj));
			} else {
				returnIds = returnObj.returnIds;
				jsonObj = returnObj.jsonObj;
			}
			const zip = new JSZIP();
			zip.loadAsync(content, {base64: true}).then((zipFiles: any) => {
				const promises: any = [];
				Object.keys(zipFiles.files).forEach(function (filename) {
					const onePromise = zipFiles.files[filename].async("string").then().catch();
					promises.push(onePromise);
				});
				Promise.all(promises).then((fileData: any) => {
					let map: any = {};
					const tBody: any = {};
					let buildings: any = {};
					try {
						buildings = buildingHelper(fileData, this, tBody, buildings);
					} catch (err) {
						console.log(err);
					}
					map = this.buildingsData(buildings, map,
						fileData, response, kind, jsonObj, id, returnIds, reject, resolve);
				});
			}).catch(function () {
				reject(new InsightError("invalid zip file"));
			});
		});
	}

	private buildingsData(buildings: any, map: any, fileData: any, response:
		{code: number; body: any;}, kind: InsightDatasetKind, jsonObj:
		Array<{id: string; data: object;}>, id: string, returnIds: string[], reject: (reason?: any) => void, resolve:
		(value: string[] | PromiseLike<string[]>) => void) {
		const lotsPromises: any[] = [];
		Object.keys(buildings).forEach((key: any) => {
			const onePromise = this.getLocations(buildings[key].address, buildings[key]).then().catch();
			lotsPromises.push(onePromise);
		});
		Promise.all(lotsPromises).then(() => {
			const roomInfo: any[] = [];
			map = mappingData(fileData, this, roomInfo, map, buildings);
			const returnFinal = finalResponse(map, response, kind, jsonObj, id, returnIds);
			if (returnFinal.code !== undefined) {
				reject(new InsightError(returnFinal));
			} else {
				resolve(returnFinal);
			}
		});
		return map;
	}


	public addDatasetCourses(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		return new Promise(function (resolve, reject) {
			const returnIds: string[] = [];

			if (id === " " || id.includes("_") === true
				|| id === undefined || id === null || id === "") {
				return reject(new InsightError("invalid id"));
			}
			let jsonObj: Array<{id: string; data: object}>;
			if (fs.existsSync(__dirname + "/../../data/" + kind + ".json")) {
				console.log("data exists");
				const jsonData = fs.readFileSync(__dirname + "/../../data/" + kind + ".json", "utf8");
				jsonObj = JSON.parse(jsonData);
				for (const key of jsonObj) {
					returnIds.push(key.id);
					if (key.id === id) {
						return reject(new InsightError("ID already exists"));
					}
				}
			}
			const zips = new JSZIP();
			zips.loadAsync(content, {base64: true}).then(function (zip: any) {
				const promises: any = [];
				Object.keys(zip.files).forEach(function (filename) {
					const onePromise = zip.files[filename].async("string").then().catch();
					promises.push(onePromise);
				});
				Promise.all(promises).then(async function (fileData: any) {
					const result = await addDatasetHelper(id, fileData, kind, jsonObj, returnIds);
					return resolve(result);
				});

			}).catch(function () {
				reject(new InsightError("invalid zip file"));
			});
		});
	}


	public removeDataset(id: string): Promise<string> {
		return new Promise(function (resolve, reject) {
			// Read the directory and get the files
			if (!fs.existsSync(__dirname + "/../../data/")) {
				return reject(new NotFoundError("issues while deleting id from the dataset"));
			}
			const jsonArr = fs.readdirSync(__dirname + "/../../data/");
			try {
				// loop through the files and check if the id is present
				jsonArr.forEach((file: any) => {
					const jsonData = fs.readFileSync(__dirname + "/../../data/" + file, "utf8");
					// covert the file content into a json object
					const jsonObj = JSON.parse(jsonData);
					// loop through the json object and check if the id is present
					// if present then return the data which doesn't match the id effectively deleting the
					// matched id from the dataset
					const dataRemoved = jsonObj.filter((el: any) => {
						return el.id !== id;
					});
					// delete the file and write the new data to the file
					fs.unlinkSync(__dirname + "/../../data/" + file);
					fs.writeFileSync(__dirname + "/../../data/" + file, JSON.stringify(dataRemoved), "utf8");
				});
				resolve(id);

			} catch (err) {
				console.log(err);
				return reject(new NotFoundError("issues while deleting id from the dataset"));
			}
		});
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		let datasets: any[] = [];
		let datasetIDs: any[] = [];
		datasets = await this.listDatasets() as any[];
		for (let a of datasets) {
			datasetIDs.push(a.id);
		}
		let queryRead = new Query();
		let queryMap = queryRead.syntacticCheck(query);
		return Promise.resolve(queryRead.semanticCheck(queryMap, datasetIDs));
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		return new Promise<InsightDataset[]>(function (fulfill, reject) {
			if (!fs.existsSync(__dirname + "/../../data/")) {
				const responseArr: InsightDataset[] = [];
				return fulfill(responseArr);
			}

			const jsonArr = fs.readdirSync(__dirname + "/../../data/");
			// jsonArr to have all the files retrieved from the directory


			jsonArr.forEach((file: any) => {
				// loop through the files and covert the file content into a json object
				const jsonData = fs.readFileSync(__dirname + "/../../data/" + file, "utf8");
				const jsonObj = JSON.parse(jsonData);
				// Parse the json data to get the id and the data in InsightDataset
				const responseArr: InsightDataset[] = [];

				jsonObj.forEach((item: any) => {
					// loop through the json object and get the id and the data
					const keys = item.data;
					const numRows = Object.keys(keys).length;
					const result: InsightDataset = {id: item.id, kind: file.split(".")[0], numRows};
					// push the id and the data into InsightDataset
					responseArr.push(result);
				});
				// return the InsightDataset array
				return fulfill(responseArr);
			});
		});
	}

	private docHelper(tBody: any, docIndex: any, aName: string): any {
		// const that = this;
		if (docIndex.nodeName === aName) {
			Object.assign(tBody, docIndex);
			return;
		} else {
			for (const element of docIndex.childNodes) {
				if (typeof element.childNodes !== "undefined") {
					this.docHelper(tBody, element, aName);
				}
			}

			return;
		}
	}


	private roomHelper(buildingInfo: any, docRoom: any, aName: string): any {

		// const that = this;
		if (typeof docRoom.attrs !== "undefined") {
			for (const element of docRoom.attrs) {
				if (typeof element !== "undefined") {
					if (element.value === aName) {
						Object.assign(buildingInfo, docRoom);
						return;
					} else {
						for (const elementChild of docRoom.childNodes) {
							if (typeof elementChild.attrs !== "undefined") {
								this.roomHelper(buildingInfo, elementChild, aName);
							}
						}
					}
				}
			}
		}
		return;
	}

	private getLocations(rooms_address: string, building: any): Promise<GeoResponse> {
		return new Promise(function (resolve, reject) {
			const roomURL: string = encodeURIComponent(rooms_address);
			http.get("http://cs310.students.cs.ubc.ca:11316/api/v1/project_team555/" + roomURL, (res) => {
				const statusCode = res.statusCode;
				const contentType = res.headers["content-type"];

				let error: any;
				if (statusCode !== 200) {
					error = new Error("Request Failed.\n" +
						`Status Code: ${statusCode}`);
				} else if (!/^application\/json/.test(contentType as string)) {
					error = new Error("Invalid content-type.\n" +
						`Expected application/json but received ${contentType}`);
				}
				if (error) {
					console.log(error.message);
					// consume response data to free up memory
					res.resume();
					return;
				}

				res.setEncoding("utf8");
				let rawData = "";
				res.on("data", (chunk) => rawData += chunk);
				res.on("end", () => {
					try {
						const parsedData = JSON.parse(rawData);
						building.lat = parsedData.lat;
						building.lon = parsedData.lon;
						resolve(parsedData);
					} catch (e) {
						reject(e);
					}
				});
			}).on("error", (e) => {
				console.log(`Got error: ${e.message}`);
			});
		});
	}
}
