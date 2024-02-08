import {InsightResult} from "./IInsightFacade";
import Decimal from "decimal.js";

export class EBNF{
	private jsonObj: Array<{id: string; data: object}>;
	constructor(jsonObj: Array<{id: string; data: object}>) {
		this.jsonObj = jsonObj;
	}

	private mfield = ["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"];
	private sfield = ["dept", "id", "instructor", "title", "uuid", "fullname", "shortname", "number", "name","address",
		"type", "furniture", "href"];

	private filters = ["AND", "OR", "LT", "GT", "EQ", "IS", "NOT"];
	public getWhere(queryMap: Map<any, any>) {
		let filter = Object.keys(queryMap.get("WHERE"))[0];
		let filterParams = queryMap.get("WHERE")[filter];
		let columns = queryMap.get("OPTIONS")["COLUMNS"];
		let unsortedResult: InsightResult[];
		let test: any[] = [];
		if (this.filters.includes(filter)) {
			if (filter === "AND" || filter === "OR") {
				test = this.logicCompare(filter, filterParams, columns);
			} else if (filter === "LT" || filter === "GT" || filter === "EQ") {
				test = this.mCompare(filter, filterParams);
			} else if (filter === "IS") {
				test = this.sCompare(filterParams);
			} else if (filter === "NOT") {
				test = this.negation(filterParams, columns);
			}
		} else if (!filter) {
			let ans = [];
			let data = this.jsonObj[0].data as Map<any, any>;
			let courses = Object.values(data);
			for (let course of courses) {
				ans.push(course);
			}
			test = ans;
		}
		let transformations: any[] = [];
		if (queryMap.get("TRANSFORMATIONS")) {
			transformations = this.getTransformations(queryMap, test);
			unsortedResult = this.getColumns(transformations[0], columns, transformations[1], true);
		} else {
			unsortedResult = this.getColumns(test, columns, transformations, false);
		}
		if (queryMap.get("OPTIONS")["ORDER"]) {
			return this.sort(unsortedResult, queryMap.get("OPTIONS")["ORDER"]);
		}
		return unsortedResult;
	}

	public getApply(apply: any, ans: any) {
		let answer = [];
		for (let applyRule of apply) {
			let temp = [];
			for (let key of Object.keys(ans)) {
				let row = [];
				let applyKey = Object.keys(applyRule)[0];
				let a = Object.keys(applyRule[Object.keys(applyRule)[0]])[0];
				let result = ans[key].map(((x: {[x: string]: any;}) => x[applyRule[Object.keys(applyRule)[0]][a]]));
				if (a === "MAX") {
					let max = result.reduce(function (l: number, m: number) {
						return Decimal.max(l, m);
					});
					row.push({[applyKey]: max});
				} else if (a === "MIN") {
					let min = result.reduce(function (l: number, m: number) {
						return Decimal.min(l, m);
					});
					row.push({[applyKey]: min});
				} else if (a === "AVG") {
					let numRows = Object.keys(ans[key]).length;
					let numbers = result.map((x: number) => new Decimal(x));
					let total = numbers.reduce(function (l: Decimal.Value, m: Decimal.Value) {
						return Decimal.add(l, m);
					});
					let avg = total.toNumber() / numRows;
					let res = Number(avg.toFixed(2));
					row.push({[applyKey]: res});
				} else if (a === "COUNT") {
					let numRows = Object.keys(ans[key]).length;
					row.push({[applyKey]: numRows});
				} else if (a === "SUM") {
					let sum = result.reduce(function (l: number, m: number) {
						return l + m;
					});
					let res = Number(sum.toFixed(2));
					row.push({[applyKey]: res});
				}
				temp.push(row[0]);
			}
			answer.push(temp);
		}
		return answer;
	}

	public getTransformations(queryMap: Map<any, any>, test: any[]) {
		let result: any[] = [];
		let ans: any[] = [];
		// Hardcoded multiple group won't work
		let x;
		if (queryMap.get("TRANSFORMATIONS")) {
			let apply = queryMap.get("TRANSFORMATIONS")["APPLY"];
			x = queryMap.get("TRANSFORMATIONS")["GROUP"][0];
			for (let groupKey of queryMap.get("TRANSFORMATIONS")["GROUP"]) {
				// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
				// Used code to group objects by property
				ans = test.reduce(function (acc, obj) {
					let key = obj[groupKey];
					if (!acc[key]) {
						acc[key] = [];
					}
					acc[key].push(obj);
					return acc;
				}, {});
			}
			let answer = this.getApply(apply, ans);
			for (let b in answer[0]) {
				let temp = {};
				Object.assign(temp, answer[0][b]);
				result.push(temp);
			}
			answer.splice(0, 1);
			for (let a of answer) {
				for (let b in a) {
					Object.assign(result[b], a[b]);
				}
			}
		}
		let z: InsightResult[] = [];
		for (let a of Object.keys(ans)) {
			z.push({[x]: a});
		}
		return [z, result];
	}

	public logicHelper(filter: string, filterParams: unknown, columns: any[]) {
		if (filter === "AND" || filter === "OR") {
			return this.logicCompare(filter, filterParams, columns);
		} else if (filter === "LT" || filter === "GT" || filter === "EQ") {
			return this.mCompare(filter, filterParams);
		} else if (filter === "IS") {
			return this.sCompare(filterParams);
		} else  if (filter === "NOT") {
			return this.negation(filterParams, columns);
		}
	}

	public logicCompare(filter: string, filterParams: any, columns: any[]) {
		let all: any[] = [];
		for (let element of filterParams) {
			all.push(this.logicHelper(Object.keys(element)[0], Object.values(element)[0], columns));
		}
		let r1 = new Set(all[0]);
		let ans = new Set();
		if (filter === "AND") {
			// https://stackoverflow.com/questions/31930894/javascript-set-data-structure-intersect
			// Used line of code to get intersection of two sets
			for (let set of all){
				let r2 = new Set(set);
				ans = new Set([...r1].filter((i) => r2.has(i)));
			}
			return Array.from(ans);
		} else {
			// https://bobbyhadz.com/blog/javascript-get-union-of-two-sets
			// Used line of code to get union of two sets
			for (let set of all){
				let r2 = new Set(set);
				ans = new Set([...r1, ...r2]);
			}
			return Array.from(ans);
		}
	}

	public getColumns(test: any[], columns: any, transformations: any[], transform: boolean){
		let ans: InsightResult[] = [];
		if (!transform) {
			for (let course of test) {
				let result: InsightResult = {};
				let temp: InsightResult[] = [];
				for (let column of columns) {
					if (column.split("_")[1] === "year"){
						let colResult: InsightResult = {[column]: parseInt(course[column], 10)};
						temp.push(colResult);
					} else {
						let colResult: InsightResult = {[column]: course[column]};
						temp.push(colResult);
					}
				}
				for (let e of temp){
					Object.assign(result, e);
				}
				ans.push(result);
			}
		} else {
			for (let a in test) {
				Object.assign(test[a], transformations[a]);
			}
			ans = test;
		}
		return ans;
	}

	public mCompare(filter: string, filterParams: any) {
		let param = Object.keys(filterParams)[0];
		let val = Object.values(filterParams)[0] as number;
		let ans = [];
		let data = this.jsonObj[0].data as Map<any, any>;
		let courses = Object.values(data);
		if (filter === "GT") {
			for (let course of courses){
				let n: number = course[param];
				if (n > val){
					ans.push(course);
				}
			}
		} else if (filter === "LT") {
			for (let course of courses){
				let n: number = course[param];
				if (n < val){
					ans.push(course);
				}
			}
		} else {
			for (let course of courses){
				let n: number = course[param];
				if (n === val){
					ans.push(course);
				}
			}
		}
		return ans;
	}

	public sCompare(filterParams: any) {
		let val = Object.values(filterParams)[0];
		let ans = [];
		let courses = Object.values(this.jsonObj[0].data as Map<any, any>);
		if (val === "*") {
			for (let course of courses) {
				ans.push(course);
			}
		} else {
			for (let course of courses) {
				let field = course[Object.keys(filterParams)[0]];
				if (field === val){
					ans.push(course);
				}
			}
		}
		return ans;
	}

	private negation(filterParams: any, columns: any) {
		let original = this.logicHelper(Object.keys(filterParams)[0], Object.values(filterParams)[0], columns) as any[];
		let all = [];
		for (let course of Object.values(this.jsonObj[0].data as Map<any, any>)) {
			all.push(course);
		}
		// https://stackoverflow.com/questions/1723168/what-is-the-fastest-or-most-elegant-way-to-compute-a-set-difference-using-javasc
		// Used code to get difference of two sets
		let r1 = new Set(all);
		let r2 = new Set(original);
		let difference = new Set([...r1].filter((x) => !r2.has(x)));
		return Array.from(difference);
	}

	public sort(unsortedResult: InsightResult[], order: any) {
			// https://stackoverflow.com/questions/21687907/typescript-sorting-an-array
			// Used to sort array of numbers and strings
		// Multiple keys in order won't work
		let key = "";
		let dir = "";
		if (typeof order === "object"){
			key = order["keys"][0];
			dir = order["dir"];
			order = order["keys"][0];
		}
		if (typeof unsortedResult[0][key] === "number" || this.mfield.includes(order.split("_")[1])) {
			unsortedResult.sort(function (x,y){
				return (x[order] as number) - (y[order] as number);
			});
		} else if (typeof unsortedResult[0][key] === "string" || this.sfield.includes(order.split("_")[1])) {
			unsortedResult.sort(function (x,y){
				if (x[order] < y[order]) {
					return -1;
				} else {
					return 1;
				}
			});
		}
		if (dir === "DOWN") {
			unsortedResult.reverse();
		}
		return unsortedResult;
	}
}
