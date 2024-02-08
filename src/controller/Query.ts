import {InsightError, ResultTooLargeError} from "./IInsightFacade";
import {EBNF} from "./EBNF";
import fs from "fs";


export class Query {
	private mfield = ["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"];
	private sfield = ["dept", "id", "instructor", "title", "uuid", "fullname", "shortname", "number", "name","address",
		"type", "furniture", "href"];

	private applyToken = ["MAX", "MIN", "AVG", "COUNT", "SUM"];

	private filters = ["AND", "OR", "LT", "GT", "EQ", "IS", "NOT"];

	public checkFilter(filter: string, values: JSON) {
		if (filter === "AND" || filter === "OR"){
			let body = Object.values(values);
			if (body.length >= 1) {
				for (let element of body) {
					if (Object.keys(element).length !== 1) {
						throw new InsightError(filter + " should only have 1 key");
					}
					if (!(this.filters.includes(Object.keys(element)[0]))) {
						throw new InsightError("Invalid filter key");
					}
					this.checkFilter(Object.keys(element)[0], Object.values(element)[0] as JSON);
				}
			} else {
				throw new InsightError("Invalid number of filters in " + filter);
			}
		} else if (filter === "LT" || filter === "GT" || filter === "EQ") {
			if (Object.keys(values).length !== 1) {
				throw new InsightError(filter + " should only have 1 key");
			}
			if (!(this.mfield.includes(Object.keys(values)[0].split("_")[1]))) {
				throw new InsightError("Invalid key type in " + filter);
			}
			if (!(Number.isFinite(Object.values(values)[0]))) {
				throw new InsightError("Value type in " + filter + " should be number");
			}
		} else if (filter === "IS") {
			if (Object.keys(values).length !== 1) {
				throw new InsightError("IS Should only have 1 key");
			}
			if (!(this.sfield.includes(Object.keys(values)[0].split("_")[1]))) {
				throw new InsightError("Invalid key type in IS");
			}
			if (!(typeof Object.values(values)[0] === "string")) {
				throw new InsightError("Value type in IS should be string");
			}
		} else if (filter === "NOT") {
			if (Object.keys(values).length !== 1) {
				throw new InsightError("NOT Should only have 1 key");
			}
			if (!(this.filters.includes(Object.keys(values)[0]))) {
				throw new InsightError("Invalid filter key");
			}
			this.checkFilter(Object.keys(values)[0], Object.values(values)[0]);
		}
	}

	public checkWhere(queryText: any) {
		let filter = Object.keys(queryText["WHERE"]);
		if (filter.length > 1) {
			throw new InsightError("WHERE shouldn't have more than 1 key");
		}
		if (filter.length === 1) {
			if (this.filters.includes(filter[0])) {
				this.checkFilter(filter[0], Object.values(queryText["WHERE"])[0] as JSON);
			}
		}
	}

	public checkOptions(queryText: any, applykeys: any[]) {
		if (!queryText["OPTIONS"]["COLUMNS"]) {
			throw new InsightError("Missing COLUMNS");
		}
		let columns = queryText["OPTIONS"]["COLUMNS"];
		for (let column of columns) {
			let field = column.split("_")[1];
			if (!this.mfield.includes(field) && !this.sfield.includes(field) && !applykeys.includes(column)) {
				throw new InsightError("Invalid key in COLUMNS");
			}
		}
		let order = queryText["OPTIONS"]["ORDER"];
		if (order) {
			if (typeof order === "object") {
				let dir = queryText["OPTIONS"]["ORDER"]["dir"];
				let keys = queryText["OPTIONS"]["ORDER"]["keys"];
				if (!dir) {
					throw new InsightError("ORDER missing dir");
				}
				if (!keys) {
					throw new InsightError("ORDER missing keys");
				}
				if (dir !== "UP" && dir !== "DOWN") {
					throw new InsightError("Invalid direction");
				}
				if (keys.length < 1) {
					throw new InsightError("ORDER keys must be non-empty");
				}
				// Don't need to check keys since all keys must be in columns?
			} else if (typeof  order === "string") {
				if (!(columns.includes(order))) {
					throw new InsightError("ORDER key must be in COLUMNS");
				}
			} else {
				throw new InsightError("Invalid ORDER type");
			}
		}
	}

	public checkGroup(group: any) {
		if (!(group.length >= 1)) {
			throw new InsightError("GROUP must be a non-empty array");
		}
		for (let key of group) {
			if (!this.sfield.includes(key.split("_")[1]) && !this.mfield.includes(key.split("_")[1])) {
				throw new InsightError("Invalid key in GROUP");
			}
		}
	}

	public checkApply(apply: any) {
		let applykeys = [];
		for (let body of apply) {
			let applykey = Object.keys(body)[0];
			if (applykey.includes("_")) {
				throw new InsightError("Can't have underscore in applykey");
			}
			if (Object.keys(body[applykey]).length !== 1) {
				throw new InsightError("Apply body should only have 1 key");
			}
			if (!(this.applyToken.includes(Object.keys(body[applykey])[0]))) {
				throw new InsightError("Invalid transformation operator");
			}
			applykeys.push(applykey);
		}
		return applykeys;
	}

	public checkTransformations(queryText: any) {
		let group = queryText["TRANSFORMATIONS"]["GROUP"];
		let apply = queryText["TRANSFORMATIONS"]["APPLY"];
		if (!group) {
			throw new InsightError("TRANSFORMATIONS missing GROUP");
		}
		if (!apply) {
			throw new InsightError("TRANSFORMATIONS missing APPLY");
		}
		this.checkGroup(group);
		return this.checkApply(apply);
	}

	public syntacticCheck(query: unknown): Map<any, any> {
		let queryMap = new Map();
		let queryJSON = query as JSON;
		let queryText = JSON.parse(JSON.stringify(queryJSON));
		// Check for Where and Options
		if (queryText["WHERE"] && queryText["OPTIONS"]) {
			let applykeys: any[] = [];
			if (queryText["TRANSFORMATIONS"]) {
				applykeys = this.checkTransformations(queryText);
			}
			this.checkWhere(queryText);
			this.checkOptions(queryText, applykeys);
		} else {
			throw new InsightError("Missing WHERE or OPTIONS");
		}
		for (let key in Object.keys(queryJSON)){
			queryMap.set(Object.keys(queryJSON)[key], Object.values(queryJSON)[key]);
		}
		return queryMap;
	}

	public semanticCheckFilter(filter: string, body: any, id: string) {
		if (filter === "AND" || filter === "OR") {
			for (let element of body) {
				this.semanticCheckFilter(Object.keys(element)[0], Object.values(element)[0], id);
			}
		} else if (filter === "LT" || filter === "GT" || filter === "EQ" || filter === "IS") {
			if (Object.keys(body)[0].split("_")[0] !== id) {
				throw new InsightError("Invalid dataset referenced");
			}
		} else if (filter === "NOT") {
			this.semanticCheckFilter(Object.keys(body)[0], Object.values(body)[0], id);
		}
	}

	public semanticCheckWhere(query: Map<any, any>, id: string) {
		let filter = Object.keys(query.get("WHERE"))[0];
		this.semanticCheckFilter(filter, query.get("WHERE")[filter], id);
	}

	public semanticCheckOptions(query: Map<any, any>, datasetIDs: any[], keys: any[]) {
		let columns = query.get("OPTIONS")["COLUMNS"];
		let id = "";
		for (let a of columns) {
			if (datasetIDs.includes(a.split("_")[0])) {
				id = a.split("_")[0];
				break;
			}
		}
		if (id === "") {
			throw new InsightError("Referencing dataset not added");
		}
		for (let column of columns) {
			if (!(id === column.split("_")[0]) && !keys.includes(column)) {
				throw new InsightError("Referencing multiple datasets");
			}
		}
		let order = query.get("OPTIONS")["ORDER"];
		if (order) {
			if (typeof order === "object") {
				let orderKeys = query.get("OPTIONS")["ORDER"]["keys"];
				for (let key of orderKeys) {
					if (!(columns.includes(key))) {
						throw new InsightError("All ORDER keys must be in COLUMNS");
					}
				}
			} else if (typeof order === "string") {
				if (id !== order.split("_")[0] && !(keys.includes(order))) {
					throw new InsightError("Invalid dataset reference in ORDER");
				}
			}
		}
		return id;
	}

	public getApplykeys(query: Map<any, any>) {
		let keys = [];
		if (query.get("TRANSFORMATIONS")) {
			let apply = query.get("TRANSFORMATIONS")["APPLY"];
			for (let body of apply) {
				keys.push(Object.keys(body)[0]);
			}
		}
		return keys;
	}

	public semanticCheckTransformations(query: Map<any, any>, kind: string) {
		if (query.get("TRANSFORMATIONS")) {
			let group = query.get("TRANSFORMATIONS")["GROUP"];
			for (let key of group) {
				if (key.split("_")[0] !== kind) {
					throw new InsightError("Invalid dataset reference");
				}
			}
			// Need to check over apply stuff
			let apply = query.get("TRANSFORMATIONS")["APPLY"];
			let applyKeys = this.getApplykeys(query);
			let applyKeysSet = new Set(applyKeys);
			if (applyKeys.length !== applyKeysSet.size) {
				throw new InsightError("Duplicate apply key");
			}
			let i = 0;
			for (let body of apply) {
				let applyToken = Object.keys(body[applyKeys[i]])[0];
				let ruleKey = Object.values(body[applyKeys[i]])[0] as string;
				if (applyToken === "MAX" || applyToken === "MIN" || applyToken === "AVG" || applyToken === "SUM") {
					if (!this.mfield.includes(ruleKey.split("_")[1])) {
						throw new InsightError("Invalid key type in " + applyToken);
					}
				} else if (applyToken === "COUNT") {
					if (!this.mfield.includes(ruleKey.split("_")[1]) &&
						!this.sfield.includes(ruleKey.split("_")[1])) {
						throw new InsightError("Invalid key in " + applyToken);
					}
				}
				i++;
			}
			let columns = query.get("OPTIONS")["COLUMNS"];
			let keys = group.concat(applyKeys);
			for (let column of columns) {
				if (!keys.includes(column)) {
					throw new InsightError("Keys in COLUMNS must be in GROUP or APPLY");
				}
			}
		}
	}

	public semanticCheck(query: Map<any, any>, datasetIDs: any[]) {
		let keys = this.getApplykeys(query);
		let kind = this.semanticCheckOptions(query, datasetIDs, keys);
		this.semanticCheckWhere(query, kind);
		this.semanticCheckTransformations(query, kind);
		let jsonData = fs.readFileSync(__dirname + "/../../data/" + kind + ".json", "utf8");
		let jsonObj: Array<{id: string; data: object}>;
		jsonObj = JSON.parse(jsonData);
		let ebnf = new EBNF(jsonObj);
		let result = ebnf.getWhere(query);
		if (result.length > 5000) {
			throw new ResultTooLargeError("Result is too big");
		} else {
			return result;
		}
	}
}

