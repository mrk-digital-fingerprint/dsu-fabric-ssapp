import ContainerController from "../../cardinal/controllers/base-controllers/ContainerController.js";
import constants from "../constants.js";
import SharedStorage from '../services/SharedDBStorageService.js';
import Utils from "../models/Utils.js";
import utils from "../utils.js";
import LogService from "../services/LogService.js";
import Product from "../models/Product.js";

export default class ProductsController extends ContainerController {
    constructor(element, history) {
        super(element, history);

        this.setModel({});
        this.storageService = new SharedStorage(this.DSUStorage);
        this.logService = new LogService(this.DSUStorage);

        this.model.addExpression('productsListLoaded', () => {
            return typeof this.model.products !== "undefined";
        }, 'products');


        this.storageService.getArray(constants.PRODUCTS_TABLE, (err, products) => {
            const lastVersionProducts = products.map(product => {
                const versions = Object.values(product)[0];
                return versions[versions.length - 1];
            });
            this.model.products = lastVersionProducts;
        });

        this.on("add-product", (event) => {
            event.stopImmediatePropagation();
            this.History.navigateToPageByTag("manage-product");
        });

        this.on("transfer", (event) => {
            const productIndex = this.getProductIndex(event);
            const product = this.model.products[productIndex];
            let actionModalModel = {
                title: "Enter the company name to which the product is transferred",
                transferCode: $$.Buffer.from(JSON.stringify(product)).toString("base64"),
                acceptButtonText: 'Accept',
                denyButtonText: 'Cancel'
            }
            this.showModal('transferProductModal', actionModalModel, (err, response) => {
                if (err || response === undefined) {
                    return;
                }

                this.model.mah = response;
            });
        });

        this.on("get-transferred-product", (event) => {
            let actionModalModel = {
                title: "Add transferred product",
                acceptButtonText: 'Accept',
                denyButtonText: 'Cancel'
            }
            this.showModal('getTransferredProductModal', actionModalModel, (err, response) => {
                if (err || response === undefined) {
                    return;
                }

                const product = JSON.parse($$.Buffer.from(response, "base64").toString());
                console.log("Product data", product);
                this.addProductToProductsList(new Product(product), ()=>{});
            });
        });

        this.on('edit-product', (event) => {
            let target = event.target;
            let targetProduct = target.getAttribute("gtin");
            const index = parseInt(targetProduct.replace(/\D/g, ''));
            this.History.navigateToPageByTag("manage-product", {index: index});
        }, {capture: true});


        this.on("view-drug", (event) => {
            this.History.navigateToPageByTag("drug-details");
        });

        this.on('openFeedback', (e) => {
            this.feedbackEmitter = e.detail;
        });
    }

    getProductIndex(event){
        let target = event.target;
        let targetProduct = target.getAttribute("gtin");
        const gtin = targetProduct.replace(/\D/g, '');
        const index = this.model.products.findIndex(product => product.gtin === gtin);
        return index;
    }

    addProductToProductsList(product, callback) {
        product.creationTime = utils.convertDateTOGMTFormat(new Date());
        this.logService.log({
            logInfo: product,
            username: this.model.username,
            action: "Added transferred product",
            logType: 'PRODUCT_LOG'
        });

        const prodElement = {};
        prodElement[product.gtin] = [product];
        this.model.products.push(prodElement);
        this.storageService.setArray(constants.PRODUCTS_TABLE, this.model.products, callback);
    }
}