import express, {Application, NextFunction, Request, Response} from "express";
import * as http from "http";
import cors from "cors";
import InsightFacade from "../controller/InsightFacade";
import fs = require("fs");
import {InsightDatasetKind} from "../controller/IInsightFacade";
import path = require("path");
let fileupload = require("express-fileupload");
let bodyParser = require("body-parser");

export default class Server {
	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;

	constructor(port: number) {
		console.info(`Server::<init>( ${port} )`);
		this.port = port;
		this.express = express();

		this.registerMiddleware();
		this.registerRoutes();

		// NOTE: you can serve static frontend files in from your express server
		// by uncommenting the line below. This makes files in ./frontend/public
		// accessible at http://localhost:<port>/
		// this.express.use(express.static("./frontend/public"))
	}

	/**
	 * Starts the server. Returns a promise that resolves if success. Promises are used
	 * here because starting the server takes some time and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<void>}
	 */
	public start(): Promise<void> {
		return new Promise((resolve, reject) => {
			console.info("Server::start() - start");
			if (this.server !== undefined) {
				console.error("Server::start() - server already listening");
				reject();
			} else {
				this.server = this.express.listen(this.port, () => {
					console.info(`Server::start() - server listening on port: ${this.port}`);
					resolve();
				}).on("error", (err: Error) => {
					// catches errors in server start
					console.error(`Server::start() - server ERROR: ${err.message}`);
					reject(err);
				});
			}
		});
	}

	/**
	 * Stops the server. Again returns a promise so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<void>}
	 */
	public stop(): Promise<void> {
		console.info("Server::stop()");
		return new Promise((resolve, reject) => {
			if (this.server === undefined) {
				console.error("Server::stop() - ERROR: server not started");
				reject();
			} else {
				this.server.close(() => {
					console.info("Server::stop() - server closed");
					resolve();
				});
			}
		});
	}

	// Registers middleware to parse request before passing them to request handlers
	private registerMiddleware() {
		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({type: "application/*", limit: "10mb"}));
		this.express.use(fileupload());
		this.express.use(bodyParser({uploadDir: path.join(__dirname, "files"), keepExtensions: true}));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
	}

	// Registers all request handlers to routes
	private registerRoutes() {
		// This is an example endpoint this you can invoke by accessing this URL in your browser:
		// http://localhost:4321/echo/hello
		this.express.get("/echo/:msg", Server.echo);

		// addDataset
		// http://localhost:3000/dataset/1/courses
		this.express.put("/dataset/:id/:kind", Server.addDataset);

		// listDatasets
		// http://localhost:3000/dataset
		this.express.get("/dataset/", Server.listDatasets);

		// removeDataset
		// http://localhost:3000/dataset/1
		this.express.delete("/dataset/:id", Server.removeDataset);

	}

	// The next two methods handle the echo service.
	// These are almost certainly not the best place to put these, but are here for your reference.
	// By updating the Server.echo function pointer above, these methods can be easily moved.
	private static echo(req: Request, res: Response) {
		try {
			console.log(`Server::echo(..) - params: ${JSON.stringify(req.params)}`);
			const response = Server.performEcho(req.params.msg);
			res.status(200).json({result: response});
		} catch (err) {
			res.status(400).json({error: err});
		}
	}

	private static performEcho(msg: string): string {
		if (typeof msg !== "undefined" && msg !== null) {
			return `${msg}...${msg}`;
		} else {
			return "Message not provided";
		}
	}

	public static addDataset(req: Request, res: Response, next: any) {
		let insightFacade: InsightFacade = new InsightFacade();
		let error: any = {};
		let uploadedFile = (req as any).files.mySubmittedFile;
		if (uploadedFile === undefined || uploadedFile === null) {
			error.code = 400;
			error.message = "file is missing";
		}
		if (error.code !== undefined) {
			res.status(400).json({error: error.message});
			return next();
		}
		insightFacade.addDataset(req.params.id, uploadedFile.data,
		req.params.kind as InsightDatasetKind)
			.then((response) => {
				res.status(200).json({response});
				return next();
			}).catch((err) => {
				res.json(err);
				return next();
			});
	}
	public static listDatasets(req: Request, res: Response, next: NextFunction) {
		let insightFacade: InsightFacade = new InsightFacade();
		insightFacade.listDatasets().then((response) => {
			res.json(response);
			return next();
		}).catch((err) => {
			res.json(err);
			return next();
		});
	}

	public static removeDataset(req: Request, res: Response, next: NextFunction) {
		let insightFacade: InsightFacade = new InsightFacade();
		insightFacade.removeDataset(req.params.id).then((response) => {
			res.json(response);
			return next();
		}).catch((err) => {
			res.json(err);
			return next();
		});
	}
}
