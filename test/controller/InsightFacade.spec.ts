import {IInsightFacade, InsightDatasetKind, InsightError,} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import {describe} from "mocha";
import {expect} from "chai";
import {clearDisk, getContentFromArchives} from "./TestUtil";
import Assertion = Chai.Assertion;
import {folderTest} from "@ubccpsc310/folder-test";

describe("InsightFacade", function () {
	let courses: string;
	let rooms: string;

	before(function () {
		courses = getContentFromArchives("courses.zip");
		rooms = getContentFromArchives("rooms.zip");
	});

	describe("List Datasets", function () {
		let facade: IInsightFacade;
		beforeEach(function () {
			clearDisk();
			facade = new InsightFacade();

		});


		it("should list no dataset", function () {
			return facade.listDatasets()
				.then((insightDataSets) => {
					expect(insightDataSets).to.be.an.instanceof(Array);
					expect(insightDataSets).to.have.length(0);
				});
		});

		it("should list one dataset", function () {

			return facade.addDataset("courses", rooms, InsightDatasetKind.Courses)
				.then((addedIds) => {
					return facade.listDatasets();
				})
				.then((insightDataSets) => {
					return expect(insightDataSets).to.deep.equal([{
						id: "courses",
						kind: InsightDatasetKind.Courses,
						numRows: 64612,
					}]);
				});
		});
		it("should list two dataset", function () {
			return facade.addDataset("courses", courses, InsightDatasetKind.Courses)
				.then(() => {
					return facade.addDataset("bob", courses, InsightDatasetKind.Courses);
				})
				.then(() => {
					return facade.listDatasets();
				})
				.then((insightDatasets) => {
					expect(insightDatasets).to.be.an.instanceof(Array);
					expect(insightDatasets).to.have.length(2);
					const insightDatasetCourses = insightDatasets.find((dataset) => dataset.id === "courses");
					expect(insightDatasetCourses).to.exist;
					expect(insightDatasetCourses).to.deep.equal({
						id: "courses",
						kind: InsightDatasetKind.Courses,
						numRows: 64612,
					});
				});
		});
	});
	describe("Add/Remove Datasets", function () {
		let facade: InsightFacade;

		beforeEach(function () {
			clearDisk();
			facade = new InsightFacade();

		});

		it("add data set", function () {
			return facade.addDataset("rooms", rooms, InsightDatasetKind.Rooms)
				.then((addedIds) => {
					return facade.listDatasets();
					//	return addedIds
				})
				.then((insightDataSets) => {
					return expect(insightDataSets[0].id).to.deep.equal("rooms");
				});
		});

		it("duplicate IDs", function () {
			return facade.addDataset("courses", courses, InsightDatasetKind.Courses)
				.then(() => {
					return facade.addDataset("courses", courses, InsightDatasetKind.Courses)
						.then((insightDataSets) => {
							expect.fail("reject");
						})
						.catch((err) => {
							expect(err instanceof InsightError).to.deep.equal(true);
						});
				});
		});
		it("id error", function () {
			return facade.addDataset("_", courses, InsightDatasetKind.Courses)
				.then((insightDataSets) => {
					expect.fail("reject");
				})
				.catch((err) => {
					expect(err instanceof InsightError).to.deep.equal(true);
				});
		});
		it("white space", function () {
			return facade.addDataset(" ", courses, InsightDatasetKind.Courses)
				.then((insightDataSets) => {
					expect.fail("reject");
				})
				.catch((err) => {
					expect(err instanceof InsightError).to.deep.equal(true);
				});
		});
		it("remove data set", function () {
			facade.removeDataset("courses");
		});

		it("id error remove", function () {
			return facade.removeDataset("_")
				.then((insightDataSets) => {
					expect.fail("reject");

				})
				.catch((err) => {
					expect(err instanceof InsightError).to.deep.equal(true);
				});
		});
		it("id error remove whitespace", function () {
			return facade.removeDataset(" ")
				.then((insightDataSets) => {
					expect.fail("reject");
				})
				.catch((err) => {
					expect(err instanceof InsightError).to.deep.equal(true);
				});
		});

		it("not zip file", function () {
			courses = getContentFromArchives("hi3.txt");
			return facade.addDataset("courses", courses, InsightDatasetKind.Courses)
				.then((insightDataSets) => {
					expect.fail("reject");
				})
				.catch((err) => {
					expect(err instanceof InsightError).to.deep.equal(true);
				});
		});
		it("empty", function () {
			courses = getContentFromArchives("empty.zip");
			return facade.addDataset("courses", courses, InsightDatasetKind.Courses)
				.then((insightDataSets) => {
					expect.fail("reject");
				})
				.catch((err) => {
					expect(err instanceof InsightError).to.deep.equal(true);
				});
		});
		it("invalid course", function () {
			courses = getContentFromArchives("invalidcourse.zip");
			return facade.addDataset("courses", courses, InsightDatasetKind.Courses)
				.then((insightDataSets) => {
					expect.fail("reject");
				})
				.catch((err) => {
					expect(err instanceof InsightError).to.deep.equal(true);
				});
		});
		it("invalid course", function () {
			courses = getContentFromArchives("invalidcoursejson.zip");
			return facade.addDataset("courses", courses, InsightDatasetKind.Courses)
				.then((insightDataSets) => {
					expect.fail("reject");
				})
				.catch((err) => {
					expect(err instanceof InsightError).to.deep.equal(true);
				});
		});


	});
});
