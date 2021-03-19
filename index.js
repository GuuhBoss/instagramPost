const express = require("express");
const app = express();
const axios = require("axios");
const fs = require("fs");
const Jimp = require("jimp");
const Instagram = require("instagram-web-api");
const cron = require("node-cron");
const imaps = require("imap-simple");
const _ = require("lodash");
const simpleParser = require("mailparser").simpleParser;

require("dotenv").config();

const port = process.env.PORT || 4000;

// Upload new Inky Doodle to Instagram every day at 4:00 PM
cron.schedule("59 15 * * *", async () => {
  const instagramLoginFunction = async () => {
    const client = new Instagram(
      {
        username: process.env.INSTAGRAM_USERNAME,
        password: process.env.INSTAGRAM_PASSWORD,
      },
      {
        language: "en-US",
        proxy:
          process.NODE_ENV === "production" ? process.env.FIXIE_URL : undefined,
      }
    );

    const instagramPostPictureFunction = async () => {
      await client
        .getPhotosByUsername({ username: process.env.INSTAGRAM_USERNAME })
        .then(
          (res) =>
            res.user.edge_owner_to_timeline_media.edges.map(
              (item) => item.node.edge_media_to_caption.edges[0].node.text
            )[0]
        )
        .then((mostRecent) => Number(mostRecent.split(" - ")[0]))
        .then((latestNumber) => {
          const updatedNumber = latestNumber + 1;

          const inkyDoodleQuery = `
                            query {
                                inkyDoodleCollection(where: {number: ${updatedNumber}}) {
                                    items   {
                                    number
                                    generation
                                    name
                                    parents
                                    image {
                                        url
                                    }
                                }
                            }
                        }
                    `;

          axios({
            url: `https://graphql.contentful.com/content/v1/spaces/${process.env.CONTENTFUL_SPACE_ID}`,
            method: "post",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.CONTENTFUL_ACCESS_TOKEN}`,
            },
            data: {
              query: inkyDoodleQuery,
            },
          })
            .then((res) => res.data)
            .then(async ({ data, errors }) => {
              if (errors) {
                console.error(errors);
              }

              const updatedInkyDoodle = data.inkyDoodleCollection.items[0];

              if (updatedInkyDoodle) {
                const updatedCaption = `${updatedNumber} - ${
                  updatedInkyDoodle.name
                }\n${
                  updatedInkyDoodle.parents
                    ? updatedInkyDoodle.parents.length > 0
                      ? updatedInkyDoodle.parents
                          .map((parent) => "#" + parent)
                          .join(" + ") + " \n"
                      : ""
                    : ""
                }#inkydoodle #gen${updatedInkyDoodle.generation}`;

                Jimp.read(updatedInkyDoodle.image.url)
                  .then((lenna) => {
                    return lenna
                      .resize(405, 405, Jimp.RESIZE_NEAREST_NEIGHBOR)
                      .quality(100)
                      .write(`./${updatedInkyDoodle.name}.jpg`, async () => {
                        // Upload converted and resized JPG to Instagram feed
                        await client
                          .uploadPhoto({
                            photo: `${updatedInkyDoodle.name}.jpg`,
                            caption: updatedCaption,
                            post: "feed",
                          })
                          .then(({ media }) => {
                            console.log(
                              `https://www.instagram.com/p/${media.code}/`
                            );
                            // Remove Local JPG File
                            fs.unlinkSync(`${updatedInkyDoodle.name}.jpg`);
                          });
                      });
                  })
                  .catch((err) => {
                    console.log(err);
                  });
              }
            });
        });
    };

    try {
      console.log("Logging in...");

      await client.login();

      console.log("Login successful!");

      setTimeout(async () => {
        await instagramPostPictureFunction();
      }, 55000);
    } catch (err) {
      console.log("Login failed!");

      if (err.status === 403) {
        console.log("Throttled!");

        return;
      }

      console.log(err.error);

      // Instagram has thrown a checkpoint error
      if (err.error && err.error.message === "checkpoint_required") {
        const challengeUrl = err.error.checkpoint_url;

        await client.updateChallenge({ challengeUrl, choice: 1 });

        const emailConfig = {
          imap: {
            user: `${process.env.INKY_DOODLE_EMAIL}`,
            password: `${process.env.INKY_DOODLE_EMAIL_PASSWORD}`,
            host: "imap.gmail.com",
            port: 993,
            tls: true,
            tlsOptions: {
              servername: "imap.gmail.com",
              rejectUnauthorized: false,
            },
            authTimeout: 30000,
          },
        };

        // Connect to email and solve Instagram challenge after delay
        const delayedEmailFunction = async (timeout) => {
          setTimeout(() => {
            imaps.connect(emailConfig).then(async (connection) => {
              return connection.openBox("INBOX").then(async () => {
                // Fetch emails from the last hour
                const delay = 1 * 3600 * 1000;
                let lastHour = new Date();
                lastHour.setTime(Date.now() - delay);
                lastHour = lastHour.toISOString();
                const searchCriteria = ["ALL", ["SINCE", lastHour]];
                const fetchOptions = {
                  bodies: [""],
                };
                return connection
                  .search(searchCriteria, fetchOptions)
                  .then((messages) => {
                    messages.forEach((item) => {
                      const all = _.find(item.parts, { which: "" });
                      const id = item.attributes.uid;
                      const idHeader = "Imap-Id: " + id + "\r\n";
                      simpleParser(idHeader + all.body, async (err, mail) => {
                        if (err) {
                          console.log(err);
                        }

                        console.log(mail.subject);

                        const answerCodeArr = mail.text
                          .split("\n")
                          .filter(
                            (item) =>
                              item && /^\S+$/.test(item) && !isNaN(Number(item))
                          );

                        if (mail.text.includes("Instagram")) {
                          if (answerCodeArr.length > 0) {
                            const answerCode = Number(answerCodeArr[0]);
                            console.log(answerCode);

                            await client.updateChallenge({
                              challengeUrl,
                              securityCode: answerCode,
                            });

                            console.log(
                              `Answered Instagram security challenge with answer code: ${answerCode}`
                            );

                            await client.login();

                            await instagramPostPictureFunction();
                          }
                        }
                      });
                    });
                  });
              });
            });
          }, timeout);
        };

        await delayedEmailFunction(50000);
      }
    }
  };

  await instagramLoginFunction();
});

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
