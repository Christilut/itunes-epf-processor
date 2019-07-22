# iTunes EPF processor

This project streams the iTunes Enterprise Partner Feed files into a MongoDB database. Currently it only saves the top 100 songs per genre, per country.

Whenever a new full feed is available, it will download that. If an incremental feed is also available, it will download that latest feed too.

It can easily be mofied to stream into a different database. And it should be no problem either to save any other data in another form.

Files are streamed from the Apple iTunes server into a BZIP2 pipe and then into an untar pipe and lastly followed by piping them through a line reader.

The cool part is that even though the iTunes song database is around 30gb unzipped, this project uses almost no memory and no diskspace at all. Only a few small things are cached (genre and storefront mapping) in order to speed things up.

## Tech

It uses TypeScript with Typegoose (mongoose TypeScript bindings) because that's really cool and much safer.

## Getting Started

Clone the repo:
```sh
git clone https://github.com/Christilut/itunes-epf-processor
cd itunes-epf-processor
```

Install dependencies:
```sh
npm install
```

Set environment variables. Remember: Don't save secrets to git!:
```sh
cp .env-example .env
```

Add your EPF credentials and mongodb host to the .env file.

Start the import process:
```sh
npm run dev
```

Or for production:
```sh
npm start
```

## Unimportant Notes

It also saves the 3 character country code from the feed as a 2 character country code because I needed that for my project.

## Logging

Universal logging library [winston](https://www.npmjs.com/package/winston) is used for logging. It has support for multiple transports.  A transport is essentially a storage device for your logs. Each instance of a winston logger can have multiple transports configured at different levels. For example, one may want error logs to be stored in a persistent remote location (like a database), but all logs output to the console or a local file. We just log to the console for simplicity, you can configure more transports as per your requirement.

In prodution, winston logs to AWS Cloudwatch. You can easily change this in `config/winston.js`.

## Errors

Errors are reported by Sentry if you added a Sentry URL in `.env`. Highly recommended to do this.

## Contributing

Contributions, questions and comments are all welcome and encouraged.

## License

MIT License. Feel free to do whatever you want with this.

## Contact

Questions, bugs, suggestions? Feel free to open an issue and I'll get back to you!
